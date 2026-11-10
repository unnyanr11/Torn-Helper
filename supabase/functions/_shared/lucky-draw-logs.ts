/** Only official receive events are used. Unrelated activity never enters campaign storage. */
export type ReceivedTransfer = {
  id: string;
  sender: number;
  timestamp: number;
  kind: "cash" | "item";
  message: string;
  assets: { item_id?: number; quantity: number }[];
};
const whole = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;
export function campaignReceivedLogs(
  payload: unknown,
  token: string,
): ReceivedTransfer[] {
  if (!/^TH-[A-F0-9]{20}$/.test(token))
    throw new Error("Invalid campaign token.");
  const log = (payload as { log?: unknown })?.log;
  if (!Array.isArray(log) || log.length > 100)
    throw new Error("Torn did not return a supported log page.");
  const matches = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`, "i"),
    result: ReceivedTransfer[] = [];
  for (const row of log) {
    const title = row?.details?.title,
      d = row?.data;
    if (
      !["Money receive", "Item receive"].includes(title) ||
      typeof d?.message !== "string" ||
      !matches.test(d.message)
    )
      continue;
    if (
      typeof row.id !== "string" ||
      row.id.length < 1 ||
      row.id.length > 200 ||
      !whole(row.timestamp) ||
      !whole(d.sender) ||
      d.message.length > 4000
    )
      throw new Error(
        "A matching received log has unsupported identity or message fields; no page was recorded.",
      );
    const assets: ReceivedTransfer["assets"] = [];
    if (title === "Money receive") {
      const amount = d.money ?? d.amount;
      if (
        !whole(amount) ||
        (d.money !== undefined &&
          d.amount !== undefined &&
          d.money !== d.amount)
      )
        throw new Error(
          "A matching cash log has an unsupported amount; no page was recorded.",
        );
      assets.push({ quantity: amount });
    } else {
      if (
        !Array.isArray(d.items) ||
        d.items.length === 0 ||
        d.items.length > 1000
      )
        throw new Error(
          "A matching item log has an unsupported item layout; no page was recorded.",
        );
      for (const item of d.items) {
        if (!whole(item?.id) || !whole(item?.qty))
          throw new Error(
            "A matching item log has an unsupported quantity; no page was recorded.",
          );
        assets.push({ item_id: item.id, quantity: item.qty });
      }
    }
    result.push({
      id: row.id,
      sender: d.sender,
      timestamp: row.timestamp,
      kind: title === "Money receive" ? "cash" : "item",
      message: d.message,
      assets,
    });
  }
  return result;
}

/** Follow only Torn's own log pagination, retaining this host-only time window. */
export function nextReceivedLogParameters(
  payload: any,
  current: Record<string, string>,
): Record<string, string> | null {
  const metadata = payload?._metadata;
  if (
    !metadata?.links ||
    !Object.prototype.hasOwnProperty.call(metadata.links, "next")
  )
    throw new Error("Log coverage metadata is missing.");
  const next = metadata.links.next;
  const fullPage =
    Array.isArray(payload.log) &&
    payload.log.length >= Number(current.limit ?? 100);
  if (next === null && !fullPage) return null;
  if (next !== null && typeof next !== "string")
    throw new Error("Unsupported log pagination.");
  const url = next === null ? null : new URL(next, "https://api.torn.com");
  if (
    url &&
    (url.origin !== "https://api.torn.com" || url.pathname !== "/v2/user/log")
  )
    throw new Error("Unsafe log pagination URL.");
  const cursor = metadata.nanostamp ?? url?.searchParams.get("nanostamp");
  if (cursor !== undefined && cursor !== null) {
    if (typeof cursor !== "string" || !/^\d{1,30}$/.test(cursor))
      throw new Error("Unsupported nanosecond paging cursor.");
    if (cursor === current.nanostamp)
      throw new Error("Repeated nanosecond cursor.");
    const result: Record<string, string> = { ...current, nanostamp: cursor };
    delete result.to;
    return result;
  }
  if (fullPage)
    throw new Error(
      "Full log page is missing its nanosecond cursor; coverage is incomplete.",
    );
  if (!url) return null;
  const result = { ...current };
  for (const name of ["from", "to", "limit"]) {
    const value = url.searchParams.get(name);
    if (value === null) continue;
    if (!/^\d+(\.\d+)?$/.test(value) || value.length > 30)
      throw new Error("Unsupported log pagination boundary.");
    if (
      name === "limit" &&
      (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100)
    )
      throw new Error("Unsupported log page size.");
    result[name] = value;
  }
  if (Object.keys(result).every((k) => result[k] === current[k]))
    throw new Error(
      "Repeated log pagination; coverage was not marked complete.",
    );
  return result;
}
export async function readCampaignRequest(
  req: Request,
): Promise<{ campaign: string }> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Choose a campaign.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2048) {
      await reader.cancel();
      throw new Error("Campaign request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (
    typeof body?.campaign !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(body.campaign)
  )
    throw new Error("Choose a campaign.");
  return { campaign: body.campaign };
}

export function receivedLogTypeIds(payload: any): string {
  if (!Array.isArray(payload?.logtypes))
    throw new Error("Torn did not return the receive-log type catalogue.");
  const wanted = ["Money receive", "Item receive"];
  const ids = wanted.map(
    (title) => payload.logtypes.find((t: any) => t.title === title)?.id,
  );
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1))
    throw new Error("Torn receive-log type definitions are unavailable.");
  return ids.join(",");
}
