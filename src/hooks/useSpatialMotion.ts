import { useEffect } from "react";
/** Pointer motion is event-driven; cards do not run a permanent render loop. */
export function useSpatialMotion(reduced: boolean) {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      typeof matchMedia === "undefined"
    )
      return;
    const system = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced || system.matches) return;
    let frame = 0,
      current: HTMLElement | null = null;
    const reset = () => {
      if (current) {
        current.style.removeProperty("--tilt-x");
        current.style.removeProperty("--tilt-y");
        current = null;
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          "--pointer-x",
          `${(event.clientX / innerWidth) * 100}%`,
        );
        document.documentElement.style.setProperty(
          "--pointer-y",
          `${(event.clientY / innerHeight) * 100}%`,
        );
        const target = (event.target as HTMLElement)?.closest<HTMLElement>(
          ".workspace-stage .card",
        );
        if (current !== target) reset();
        if (
          !target ||
          target.contains(document.activeElement) ||
          !matchMedia("(hover: hover)").matches
        ) {
          reset();
          return;
        }
        current = target;
        const rect = target.getBoundingClientRect();
        target.style.setProperty(
          "--tilt-x",
          `${(0.5 - (event.clientY - rect.top) / rect.height) * 2}deg`,
        );
        target.style.setProperty(
          "--tilt-y",
          `${((event.clientX - rect.left) / rect.width - 0.5) * 2}deg`,
        );
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = "visible";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0 },
    );
    function discover(node: ParentNode) {
      node
        .querySelectorAll<HTMLElement>(
          ".workspace-stage .card, .workspace-stage fieldset",
        )
        .forEach((element) => {
          if (element.dataset.reveal) return;
          element.dataset.reveal = "pending";
          observer.observe(element);
        });
    }
    discover(document);
    const mutations = new MutationObserver(() => discover(document));
    mutations.observe(document.getElementById("root")!, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", reset);
    const stop = () => {
      if (system.matches) {
        reset();
        document
          .querySelectorAll<HTMLElement>('[data-reveal="pending"]')
          .forEach((el) => {
            el.dataset.reveal = "visible";
          });
      }
    };
    system.addEventListener("change", stop);
    return () => {
      cancelAnimationFrame(frame);
      reset();
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", reset);
      system.removeEventListener("change", stop);
      document
        .querySelectorAll<HTMLElement>('[data-reveal="pending"]')
        .forEach((el) => {
          el.dataset.reveal = "visible";
        });
    };
  }, [reduced]);
}
