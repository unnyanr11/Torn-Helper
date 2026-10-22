/** Factual starter snapshot from Baldr's public Torn forum guide, retrieved 2026-10-22.
 * Provenance: official Torn thread 16034448, first levelling table.
 * No runtime connection to an external target site. Community reports are not API stats.
 * The source supplies no per-target report dates; snapshot date is retrieval only.
 */
export const LEVELLING_SNAPSHOT = '2026-10-22';
export interface StarterTarget { id:number; name:string; reportedLevel:number; reportedTotal:number }
const records:[number,string,number,number][] = [
 [2117366,'svyatoslavy',41,40], [532451,'Clari',29,957],
 [1297740,'hildreth',28,47], [945131,'253362',28,761],
 [387822,'russellkill',28,763], [560511,'ryanbooth',27,317],
 [504854,'cloverkid13',27,329], [1171323,'athulya_rose',27,785],
 [523205,'kopite93',27,837], [446858,'Kristopher',26,291],
 [316768,'ilekilluall8',26,335], [1363475,'Sir_Astorre',26,579],
 [491089,'Dannyyyy',26,591], [1352431,'ltk919',26,985],
 [323890,'Geoff',25,40], [1423507,'PuLse97',25,356],
 [1169520,'shark78',25,387], [929419,'Phenomenal23',25,677],
 [1492332,'Babakadush',25,684], [1265642,'agreaves',24,90],
 [1420387,'jourdan101',24,97], [655562,'Xx_Sophiie_xX',24,286],
 [1599198,'minyan',24,287], [1380348,'shazzadshazzad',24,447],
 [663762,'me1921',24,462], [443815,'wooden',24,771],
 [443421,'loppolman',24,796], [906369,'Alex430',23,122],
 [353299,'yaesu001',23,126], [1432752,'ivvyxvanity',23,278],
 [659243,'Monica',23,290], [1235477,'starwars83',23,482],
];
export const STARTER_TARGETS:StarterTarget[] = records.map(([id,name,reportedLevel,reportedTotal])=>({id,name,reportedLevel,reportedTotal}));
