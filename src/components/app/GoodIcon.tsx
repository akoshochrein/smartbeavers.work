import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Original icons for Timberborn's goods, drawn for smartbeavers on a 24×24 grid. They are not
// the game's artwork. Flat fills, no outlines, so they stay readable at 20px.

const C = {
  wood: "#a9743f",
  woodDark: "#7a4a2a",
  woodLight: "#d6a56c",
  treated: "#4f3a2c",
  metal: "#8b979e",
  metalDark: "#56626a",
  metalLight: "#c8d1d6",
  rust: "#b0623a",
  water: "#2f9fd0",
  waterLight: "#9fd8f0",
  bad: "#a3262c",
  badLight: "#e07a6a",
  green: "#5d9e3e",
  greenDark: "#35702c",
  greenLight: "#a9d37a",
  yellow: "#f2b33d",
  yellowLight: "#fbdc8a",
  cream: "#f3e6c8",
  paper: "#f6f1e4",
  red: "#d2473c",
  purple: "#6d3f9c",
  purpleLight: "#a57fd0",
  orange: "#e8822c",
  brown: "#8a5a34",
  tan: "#d9b27c",
  ink: "#27302e",
  amber: "#e59a1f",
  glass: "#d7e7ea",
  berry: "#3f55b5",
};

const drop = (fill: string, shine: string) => (
  <>
    <path d="M12 2.5c3.4 4.3 6.5 7.9 6.5 12a6.5 6.5 0 0 1-13 0c0-4.1 3.100-7.700 6.500-12Z" fill={fill} />
    <path d="M8.300 14.500a3.700 3.700 0 0 0 2.700 3.600" stroke={shine} strokeWidth="1.600" strokeLinecap="round" fill="none" />
  </>
);

/** Ration tin: lid, body and a label in the food's colour. */
const tin = (label: string, emblem: ReactNode) => (
  <>
    <rect x="5" y="5" width="14" height="15" rx="2" fill={C.metal} />
    <rect x="4" y="4" width="16" height="3" rx="1.500" fill={C.metalLight} />
    <rect x="5" y="9.500" width="14" height="7" fill={label} />
    {emblem}
  </>
);

/** Fermenting jar: cloth lid, glass, contents. */
const jar = (contents: string, bits: ReactNode) => (
  <>
    <rect x="5.500" y="7" width="13" height="14" rx="3" fill={C.glass} />
    <rect x="5.500" y="11" width="13" height="10" rx="3" fill={contents} />
    <rect x="5.500" y="11" width="13" height="3" fill={contents} />
    <rect x="7" y="3.500" width="10" height="4" rx="1" fill={C.woodDark} />
    {bits}
  </>
);

const sack = (emblem: ReactNode) => (
  <>
    <path d="M6 9c-1.500 3-2 6-1.500 9.500.2 1.500 1.200 2.500 2.700 2.500h9.600c1.500 0 2.500-1 2.700-2.500.5-3.500 0-6.500-1.500-9.500Z" fill={C.cream} />
    <path d="M8 4.500 12 6l4-1.500-1.200 4.500H9.200Z" fill={C.tan} />
    <rect x="8.500" y="8" width="7" height="1.800" rx=".9" fill={C.woodDark} />
    {emblem}
  </>
);

const bottle = (liquid: string, label: ReactNode) => (
  <>
    <rect x="10" y="2.500" width="4" height="3" rx=".8" fill={C.woodDark} />
    <path d="M10.200 5.500h3.600v3c2 1 3.200 2.500 3.200 4.500v6.500a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V13c0-2 1.200-3.500 3.200-4.500Z" fill={liquid} />
    {label}
  </>
);

const grill = (
  <path d="M7 10.500l7-4M8 15l9-5.200M11 18l7-4" stroke={C.ink} strokeOpacity=".55" strokeWidth="1.500" strokeLinecap="round" fill="none" />
);

const chestnut = (
  <>
    <path d="M12 4c.8 1.800 2.500 2.300 4.500 3.500 2.200 1.300 3.500 3.300 3.500 5.800 0 4-3.600 6.700-8 6.700s-8-2.700-8-6.700c0-2.500 1.300-4.500 3.500-5.800C9.500 6.300 11.200 5.800 12 4Z" fill={C.woodDark} />
    <path d="M5.200 15.500c1.500 2.800 4 4.500 6.800 4.500s5.300-1.700 6.800-4.500c-2 .9-4.300 1.300-6.800 1.300s-4.800-.4-6.800-1.300Z" fill={C.tan} />
  </>
);

const potato = (
  <>
    <path d="M4 13c0-4 3.500-7.500 8-7.500 5 0 8.500 2.500 8.500 6.500s-3.500 7-9 7C7 19 4 16.500 4 13Z" fill={C.tan} />
    <circle cx="9" cy="11" r="1" fill={C.brown} />
    <circle cx="14.500" cy="14.500" r="1" fill={C.brown} />
    <circle cx="15" cy="9.500" r=".8" fill={C.brown} />
  </>
);

const cattail = (
  <>
    <rect x="11.300" y="3" width="1.400" height="18" rx=".7" fill={C.greenDark} />
    <rect x="9.700" y="5.500" width="4.600" height="9" rx="2.300" fill={C.woodDark} />
    <path d="M12 21c-3-1-4.500-3.500-4.500-7 2 1.500 3.500 3.500 4.500 7ZM12 21c2.500-1.500 4-3.500 4.500-6.500-2 1-3.500 3-4.500 6.500Z" fill={C.green} />
  </>
);

const wheat = (
  <>
    <rect x="11.300" y="9" width="1.400" height="12.500" rx=".7" fill={C.amber} />
    <ellipse cx="12" cy="4.500" rx="1.800" ry="2.500" fill={C.yellow} />
    {[7.500, 11, 14.500].map((y) => (
      <g key={y}>
        <ellipse cx="9.200" cy={y} rx="1.700" ry="2.500" transform={`rotate(-30 9.200 ${y})`} fill={C.yellow} />
        <ellipse cx="14.800" cy={y} rx="1.700" ry="2.500" transform={`rotate(30 14.800 ${y})`} fill={C.yellow} />
      </g>
    ))}
  </>
);

const lotus = (fill: string) => (
  <>
    <circle cx="12" cy="12" r="8.500" fill={fill} />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <ellipse key={a} cx="12" cy="6.800" rx="1.500" ry="2" transform={`rotate(${a} 12 12)`} fill={C.woodDark} fillOpacity=".7" />
    ))}
    <circle cx="12" cy="12" r="1.500" fill={C.woodDark} fillOpacity=".7" />
  </>
);

const boards = (a: string, b: string) => (
  <>
    <rect x="2.500" y="14.500" width="17" height="4.500" rx="1" fill={a} />
    <rect x="4.500" y="9.500" width="17" height="4.500" rx="1" fill={b} />
    <rect x="2.500" y="4.500" width="17" height="4.500" rx="1" fill={a} />
    <path d="M6 6.700h8M8 11.700h9M6 16.700h7" stroke={C.ink} strokeOpacity=".25" strokeWidth="1" strokeLinecap="round" />
  </>
);

const ICONS: Record<string, ReactNode> = {
  Water: drop(C.water, C.waterLight),
  Badwater: (
    <>
      {drop(C.bad, C.badLight)}
      <circle cx="14.500" cy="12" r="1.300" fill={C.badLight} />
    </>
  ),

  // Food
  Berries: (
    <>
      <path d="M12 3c2.500 0 4.500 1 5.500 3-2.500.8-4.500.3-5.500-3Z" fill={C.green} />
      <rect x="11.400" y="3" width="1.200" height="6" rx=".6" fill={C.greenDark} />
      <circle cx="8" cy="12" r="4" fill={C.berry} />
      <circle cx="16" cy="12.500" r="4" fill={C.berry} />
      <circle cx="12" cy="17" r="4" fill="#5a70d6" />
      <circle cx="10.800" cy="15.800" r="1" fill="#fff" fillOpacity=".5" />
    </>
  ),
  Bread: (
    <>
      <path d="M3 13c0-4 4-6.500 9-6.500s9 2.500 9 6.500v3.500a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill={C.wood} />
      <path d="M8 9.500l-1.500 4M12.500 9l-1.500 4.500M17 9.500l-1.500 4" stroke={C.yellowLight} strokeWidth="1.600" strokeLinecap="round" />
    </>
  ),
  Carrots: (
    <>
      <path d="M14 3c-1 1.500-1.200 3-.8 4.800M17.500 4.500c-1.800.5-3 1.600-3.700 3.300M20 8c-1.900-.3-3.500.2-5 1.200" stroke={C.green} strokeWidth="1.800" strokeLinecap="round" fill="none" />
      <path d="M16.500 8.500c1.500 1.500 1.300 3.500-.3 5.300L5 21.500c-1.300.8-2.800-.7-2-2L10.700 8.300c1.800-1.600 4.300-1.300 5.800.2Z" fill={C.orange} />
      <path d="M9.500 13l1.500 1.500M7 16.500 8.500 18M12.500 10l1.500 1.500" stroke="#b85f17" strokeWidth="1.200" strokeLinecap="round" />
    </>
  ),
  CattailCrackers: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.500" fill={C.tan} />
      {[8, 12, 16].flatMap((x) => [8, 12, 16].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={C.woodDark} />))}
    </>
  ),
  GrilledChestnuts: (
    <>
      {chestnut}
      {grill}
    </>
  ),
  GrilledPotatoes: (
    <>
      <path d="M4 13c0-4 3.500-7.500 8-7.500 5 0 8.500 2.500 8.500 6.500s-3.500 7-9 7C7 19 4 16.500 4 13Z" fill={C.amber} />
      {grill}
    </>
  ),
  GrilledSpadderdock: (
    <>
      {lotus(C.amber)}
      <path d="M5 9.500l14-3M5 17.500l14-3" stroke={C.ink} strokeOpacity=".5" strokeWidth="1.500" strokeLinecap="round" />
    </>
  ),
  MaplePastries: (
    <>
      <circle cx="12" cy="12" r="9" fill={C.wood} />
      <path d="M12 12c0-1.500 2.500-1.500 2.500.5 0 2.500-5.500 2.500-5.500-1 0-4 8.500-4 8.500 1 0 5-11.500 5-11.500-1" stroke={C.yellowLight} strokeWidth="1.800" strokeLinecap="round" fill="none" />
    </>
  ),
  SunflowerSeeds: (
    <>
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
        <ellipse key={a} cx="12" cy="4.500" rx="1.900" ry="3.200" transform={`rotate(${a} 12 12)`} fill={C.yellow} />
      ))}
      <circle cx="12" cy="12" r="5" fill={C.woodDark} />
      <circle cx="10.500" cy="11" r=".8" fill={C.tan} />
      <circle cx="13.500" cy="11.500" r=".8" fill={C.tan} />
      <circle cx="12" cy="14" r=".8" fill={C.tan} />
    </>
  ),
  AlgaeRations: tin(C.green, <path d="M9 15.500c1-1.500 1-3 0-4.500M12 15.500c1-1.500 1-3 0-4.500M15 15.500c1-1.500 1-3 0-4.500" stroke={C.greenLight} strokeWidth="1.400" strokeLinecap="round" fill="none" />),
  CornRations: tin(C.yellow, <>{[9.500, 12, 14.500].flatMap((x) => [11.500, 14.500].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#b97f12" />))}</>),
  EggplantRations: tin(C.purple, <ellipse cx="12" cy="13" rx="3.500" ry="2" fill={C.purpleLight} />),
  FermentedCassava: jar(C.cream, <><rect x="8" y="13.500" width="3" height="5.500" rx="1.500" fill={C.brown} /><rect x="13" y="13" width="3" height="6" rx="1.500" fill={C.brown} /></>),
  FermentedMushrooms: jar("#e9c9a8", <><path d="M8 16.500a2.500 2.500 0 0 1 5 0Z" fill={C.red} /><path d="M12.500 18.500a2 2 0 0 1 4 0Z" fill={C.red} /></>),
  FermentedSoybeans: jar(C.greenLight, <><circle cx="9.500" cy="15" r="1.400" fill={C.greenDark} /><circle cx="13.500" cy="14.500" r="1.400" fill={C.greenDark} /><circle cx="11.500" cy="18" r="1.400" fill={C.greenDark} /><circle cx="15.500" cy="18" r="1.400" fill={C.greenDark} /></>),
  Kohlrabies: (
    <>
      <path d="M9 11c-1-3-2.500-5-5-6M12 10c0-3 .2-5 1-7.500M15 11c1-3 2.500-4.500 5-5.500" stroke={C.green} strokeWidth="1.800" strokeLinecap="round" fill="none" />
      <ellipse cx="3.800" cy="4.800" rx="2" ry="1.300" transform="rotate(25 3.800 4.800)" fill={C.green} />
      <ellipse cx="20.200" cy="5.300" rx="2" ry="1.300" transform="rotate(-25 20.200 5.300)" fill={C.green} />
      <ellipse cx="13.200" cy="2.800" rx="1.300" ry="2" fill={C.green} />
      <ellipse cx="12" cy="15.500" rx="7" ry="6" fill="#cfe6a8" />
      <path d="M8.500 13c1 .5 1.500 1.500 1.500 2.500M15.500 13c-1 .5-1.500 1.500-1.500 2.500" stroke={C.green} strokeWidth="1" strokeLinecap="round" fill="none" />
    </>
  ),
  MangroveFruits: (
    <>
      <path d="M5 4c3-1.500 6-1.500 9 0" stroke={C.woodDark} strokeWidth="1.800" strokeLinecap="round" fill="none" />
      <path d="M9.500 3.500c2.500.5 3.500 2 3 4h-4c-.5-1.500-.2-3 1-4Z" fill={C.greenDark} />
      <path d="M8.500 7h4c1 5 .5 10-2 14.500C8 17 7.500 12 8.500 7Z" fill={C.green} />
      <path d="M16 4.500c2.500 1.500 4 4 4 6.500-2.500-.5-4.500-2.500-4-6.500Z" fill={C.greenLight} />
    </>
  ),

  // Ingredients
  CattailFlour: sack(<rect x="10.500" y="12" width="3" height="6" rx="1.500" fill={C.woodDark} />),
  CattailRoots: cattail,
  Chestnuts: chestnut,
  MapleSyrup: bottle(
    C.amber,
    <path d="M12 12l1 1.500 1.800-.3-.8 1.800 1 1.300-1.800.2-.5 2h-1.400l-.5-2-1.800-.2 1-1.300-.8-1.800 1.800.3Z" fill={C.red} />,
  ),
  Potatoes: potato,
  Spadderdock: (
    <>
      <path d="M12 21a9 7 0 1 1 6.300-2l-6.300-5Z" fill={C.green} />
      <circle cx="12.500" cy="8.500" r="3.500" fill={C.yellow} />
      <circle cx="12.500" cy="8.500" r="1.500" fill={C.amber} />
    </>
  ),
  Wheat: wheat,
  WheatFlour: sack(
    <>
      <rect x="11.400" y="12" width="1.200" height="7" rx=".6" fill={C.amber} />
      <ellipse cx="10" cy="13.500" rx="1.200" ry="1.800" transform="rotate(-30 10 13.500)" fill={C.yellow} />
      <ellipse cx="14" cy="13.500" rx="1.200" ry="1.800" transform="rotate(30 14 13.500)" fill={C.yellow} />
      <ellipse cx="10" cy="16.500" rx="1.200" ry="1.800" transform="rotate(-30 10 16.500)" fill={C.yellow} />
      <ellipse cx="14" cy="16.500" rx="1.200" ry="1.800" transform="rotate(30 14 16.500)" fill={C.yellow} />
    </>,
  ),
  Algae: (
    <>
      <path d="M7 21c2-3-2-5 0-8s-2-5 0-8" stroke={C.greenDark} strokeWidth="2.600" strokeLinecap="round" fill="none" />
      <path d="M12 21c2-3-2-6 0-9s-2-5 0-9" stroke={C.green} strokeWidth="2.600" strokeLinecap="round" fill="none" />
      <path d="M17 21c2-3-2-5 0-8s-2-4 0-6" stroke={C.greenLight} strokeWidth="2.600" strokeLinecap="round" fill="none" />
    </>
  ),
  CanolaOil: bottle(C.yellow, <path d="M12 12.500c1.500 2 2.500 3.300 2.500 4.500a2.500 2.500 0 0 1-5 0c0-1.200 1-2.500 2.500-4.500Z" fill={C.yellowLight} />),
  CanolaSeeds: (
    <>
      {[0, 90, 180, 270].map((a) => (
        <ellipse key={a} cx="12" cy="4.800" rx="2.200" ry="2.600" transform={`rotate(${a} 12 8)`} fill={C.yellow} />
      ))}
      <circle cx="12" cy="8" r="1.300" fill={C.amber} />
      {[[7, 17], [10.500, 15.500], [14, 17], [17.500, 15.500], [8.500, 20], [12.200, 19.500], [16, 20]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.500" fill={C.ink} />
      ))}
    </>
  ),
  Cassava: (
    <>
      <path d="M4 7c3-2 6.500-.5 9 3l7.500 9c.5 1-.5 2-1.500 1.500l-10-6C5.500 12.500 3 10 4 7Z" fill={C.brown} />
      <ellipse cx="5.800" cy="8" rx="2" ry="2.600" transform="rotate(-35 5.800 8)" fill={C.cream} />
      <path d="M10 10.500l-1.500 1.500M13 13.500 11.500 15M16 17l-1.200 1.200" stroke={C.treated} strokeWidth="1.200" strokeLinecap="round" />
    </>
  ),
  CoffeeBeans: (
    <>
      <ellipse cx="8.500" cy="10" rx="4.500" ry="6" transform="rotate(-25 8.500 10)" fill={C.woodDark} />
      <path d="M7 5c2.500 3-1 6.500 2.500 10" stroke={C.tan} strokeWidth="1.300" strokeLinecap="round" fill="none" />
      <ellipse cx="15.500" cy="15" rx="4.300" ry="5.500" transform="rotate(30 15.500 15)" fill={C.treated} />
      <path d="M18 10.500c-3 2.500.5 6-3.500 9" stroke={C.tan} strokeWidth="1.300" strokeLinecap="round" fill="none" />
    </>
  ),
  Corn: (
    <>
      <path d="M12 2.500c3 0 4.500 3.500 4.500 8.500S15 20.500 12 20.500 7.500 16 7.500 11 9 2.500 12 2.500Z" fill={C.yellow} />
      <path d="M10 5v13M12 4v15M14 5v13M8.300 8h7.400M8 11.500h8M8.300 15h7.400" stroke="#c78a14" strokeWidth=".9" />
      <path d="M12 22c-4.500 0-7-3.500-7-9.500 2.500 1.500 5 4.500 7 9.500ZM12 22c4.500 0 7-3.500 7-9.500-2.500 1.500-5 4.500-7 9.500Z" fill={C.green} />
    </>
  ),
  Eggplants: (
    <>
      <path d="M14.500 8c3.500 2.500 4 7 1.500 10.500s-7 4-10 1.500-3-6.500 0-9.500 5.500-4.500 8.500-2.500Z" fill={C.purple} />
      <path d="M12.500 6.500c2-.5 4 .5 5 2.500l-2 .2-.8 1.800-1.700-1.200-2 .5c-.2-1.800.3-3.200 1.500-3.800Z" fill={C.green} />
      <path d="M15.500 6.500 18.500 3" stroke={C.greenDark} strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14c-1 1.500-1 3 0 4.500" stroke={C.purpleLight} strokeWidth="1.400" strokeLinecap="round" fill="none" />
    </>
  ),
  Mushrooms: (
    <>
      <rect x="9.500" y="11" width="5" height="10" rx="2.200" fill={C.cream} />
      <path d="M2.500 13c0-5.500 4-9.500 9.500-9.500s9.500 4 9.500 9.500c0 .8-.5 1-1.200 1H3.700c-.7 0-1.200-.2-1.200-1Z" fill={C.red} />
      <circle cx="8" cy="9" r="1.500" fill={C.cream} />
      <circle cx="13.500" cy="7" r="1.200" fill={C.cream} />
      <circle cx="16.500" cy="10.500" r="1.100" fill={C.cream} />
    </>
  ),
  Soybeans: (
    <>
      <path d="M4 17.500C3 12 7 6 13 4c3-1 6 0 7 2 1 2.500-1 4-3 5-3 1.500-4.500 3-5.500 6-1 3-6.500 4-7.500.5Z" fill={C.green} />
      <circle cx="8" cy="15.500" r="2.300" fill={C.greenLight} />
      <circle cx="11.500" cy="10.500" r="2.300" fill={C.greenLight} />
      <circle cx="16" cy="7.500" r="2.100" fill={C.greenLight} />
    </>
  ),

  // Materials
  Logs: (
    <>
      {[[7.500, 16], [16.500, 16], [12, 8.500]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="4.500" fill={C.woodDark} />
          <circle cx={x} cy={y} r="3.300" fill={C.woodLight} />
          <circle cx={x} cy={y} r="1.400" fill="none" stroke={C.wood} strokeWidth="1" />
        </g>
      ))}
    </>
  ),
  Planks: boards(C.woodLight, C.tan),
  TreatedPlanks: boards(C.treated, "#66493a"),
  Gears: (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} x="10.200" y="2" width="3.600" height="5" rx=".8" transform={`rotate(${a} 12 12)`} fill={C.metal} />
      ))}
      <circle cx="12" cy="12" r="7" fill={C.metal} />
      <circle cx="12" cy="12" r="3" fill={C.metalDark} />
    </>
  ),
  ScrapMetal: (
    <>
      <path d="M3 18 6 9l5 3-1 7Z" fill={C.rust} />
      <path d="M9 13l4-9 6 4-3 8Z" fill={C.metal} />
      <path d="M12 20l3-6 6 1-1 5Z" fill={C.metalDark} />
      <path d="M11 9l4 2" stroke={C.metalLight} strokeWidth="1.200" strokeLinecap="round" />
    </>
  ),
  MetalBlocks: (
    <>
      <path d="M5 13h14l2 6H3Z" fill={C.metalDark} />
      <path d="M6 13h12l-1.500-4.500h-9Z" fill={C.metal} />
      <path d="M8.500 6h7l1 2.500h-9Z" fill={C.metalLight} />
    </>
  ),
  PineResin: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1.500" fill={C.woodDark} />
      <path d="M6 5.500h4M13 6.500h5" stroke={C.treated} strokeWidth="1.200" strokeLinecap="round" />
      <path d="M9 9h6c0 2.500 2.500 4.500 2.500 7.500a5.500 5.500 0 0 1-11 0C6.500 13.500 9 11.500 9 9Z" fill={C.amber} />
      <path d="M9.500 15.500a2.700 2.700 0 0 0 1.800 3" stroke={C.yellowLight} strokeWidth="1.500" strokeLinecap="round" fill="none" />
    </>
  ),
  Dirt: (
    <>
      <path d="M2 19c1.500-6 5-10.500 10-10.500S20.500 13 22 19c.2.800-.3 1.500-1.200 1.500H3.200c-.9 0-1.400-.7-1.200-1.500Z" fill={C.brown} />
      <circle cx="9" cy="14" r="1.100" fill={C.treated} />
      <circle cx="14" cy="12.500" r=".9" fill={C.treated} />
      <circle cx="16" cy="17" r="1.200" fill={C.treated} />
      <circle cx="7" cy="18" r=".9" fill={C.tan} />
      <circle cx="12" cy="17" r=".8" fill={C.tan} />
    </>
  ),
  Extract: (
    <>
      <rect x="9.500" y="2.500" width="5" height="2" rx=".8" fill={C.woodDark} />
      <path d="M10.300 4.500h3.400v5l5 9c.7 1.300-.2 3-1.700 3H7c-1.500 0-2.400-1.700-1.700-3l5-9Z" fill={C.glass} />
      <path d="M8.300 14h7.400l2.500 4.500c.7 1.300-.2 3-1.700 3H7.500c-1.500 0-2.400-1.700-1.700-3Z" fill={C.green} />
      <circle cx="11" cy="17.500" r="1" fill={C.greenLight} />
      <circle cx="14" cy="16" r=".7" fill={C.greenLight} />
    </>
  ),
  Explosives: (
    <>
      <rect x="4" y="9" width="4.600" height="12" rx="1.200" fill={C.red} />
      <rect x="9.700" y="9" width="4.600" height="12" rx="1.200" fill="#b9382f" />
      <rect x="15.400" y="9" width="4.600" height="12" rx="1.200" fill={C.red} />
      <rect x="3" y="13" width="18" height="3" rx="1" fill={C.ink} />
      <path d="M12 9c0-3 2-3 3-5" stroke={C.ink} strokeWidth="1.400" strokeLinecap="round" fill="none" />
      <circle cx="15.500" cy="3.500" r="1.600" fill={C.yellow} />
    </>
  ),
  Fireworks: (
    <>
      <path d="M4 21 11 13" stroke={C.woodDark} strokeWidth="1.600" strokeLinecap="round" />
      <path d="M9 15l6-8.500c2-.8 3.500-.3 4 .5.8.5 1.300 2 .5 4L11 17Z" fill={C.purple} />
      <path d="M15 6.500c2-.8 3.500-.3 4 .5.8.5 1.300 2 .5 4Z" fill={C.red} />
      <path d="M11.500 11.500l3 3" stroke={C.yellow} strokeWidth="1.600" strokeLinecap="round" />
      <path d="M5 4v3M3.500 5.500h3M20 15v3M18.500 16.500h3M9 2.500v2M8 3.500h2" stroke={C.yellow} strokeWidth="1.300" strokeLinecap="round" />
    </>
  ),
  BotChassis: (
    <>
      <rect x="5" y="5" width="14" height="15" rx="2.500" fill={C.metal} />
      <circle cx="12" cy="10.500" r="3" fill={C.metalDark} />
      <circle cx="12" cy="10.500" r="1.300" fill={C.yellow} />
      <path d="M8.500 15.500h7M8.500 17.500h7" stroke={C.metalDark} strokeWidth="1.200" strokeLinecap="round" />
      <rect x="2.500" y="8" width="2.500" height="4" rx="1" fill={C.metalDark} />
      <rect x="19" y="8" width="2.500" height="4" rx="1" fill={C.metalDark} />
    </>
  ),
  BotHeads: (
    <>
      <rect x="11.300" y="2.500" width="1.400" height="4" fill={C.metalDark} />
      <circle cx="12" cy="2.800" r="1.500" fill={C.red} />
      <rect x="4" y="6.500" width="16" height="13" rx="3" fill={C.metal} />
      <circle cx="9" cy="12" r="2.200" fill={C.yellow} />
      <circle cx="15" cy="12" r="2.200" fill={C.yellow} />
      <rect x="8.500" y="16" width="7" height="1.500" rx=".7" fill={C.metalDark} />
    </>
  ),
  BotLimbs: (
    <>
      <path d="M6 19 12 9l6 3" stroke={C.metal} strokeWidth="3.600" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12" cy="9" r="2.600" fill={C.metalDark} />
      <circle cx="12" cy="9" r="1" fill={C.metalLight} />
      <circle cx="6" cy="19" r="2.400" fill={C.metalDark} />
      <path d="M17.500 9.500 21 8M18 13.500l3.200 1.200" stroke={C.metalDark} strokeWidth="1.800" strokeLinecap="round" />
    </>
  ),
  Paper: (
    <>
      <path d="M6 3h8l4.500 4.500V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill={C.paper} stroke={C.tan} strokeWidth="1" />
      <path d="M14 3v4.500h4.500Z" fill={C.tan} />
      <path d="M8 11h7.500M8 14h7.500M8 17h5" stroke={C.metal} strokeWidth="1.200" strokeLinecap="round" />
    </>
  ),
  Books: (
    <>
      <rect x="4" y="15.500" width="16" height="4.500" rx="1" fill={C.red} />
      <rect x="15" y="16.500" width="4" height="2.500" fill={C.paper} />
      <rect x="5.500" y="10.500" width="14" height="4.500" rx="1" fill={C.water} />
      <rect x="6.500" y="11.500" width="4" height="2.500" fill={C.paper} />
      <rect x="4.500" y="5.500" width="15" height="4.500" rx="1" fill={C.greenDark} />
      <rect x="14.500" y="6.500" width="4" height="2.500" fill={C.paper} />
    </>
  ),
  PunchCards: (
    <>
      <path d="M3 6.500h14.500L21 10v7.500a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" fill={C.cream} stroke={C.tan} strokeWidth="1" />
      {[[5.500, 10], [9.500, 10], [15.500, 11], [7.500, 13], [12.500, 13], [5.500, 16], [10.500, 16], [16.500, 15.500]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y - 0.800} width="1.600" height="1.800" fill={C.ink} />
      ))}
    </>
  ),
  Dandelions: (
    <>
      <path d="M12 21V11" stroke={C.greenDark} strokeWidth="1.600" strokeLinecap="round" />
      <path d="M12 19c-3 0-5-1.500-6-4 3 0 5 1.500 6 4ZM12 17c2.500 0 4.500-1 5.500-3-2.500-.3-4.500.8-5.500 3Z" fill={C.green} />
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => (
        <ellipse key={a} cx="12" cy="3.800" rx="1.400" ry="3" transform={`rotate(${a} 12 8)`} fill={C.yellow} />
      ))}
      <circle cx="12" cy="8" r="2.200" fill={C.amber} />
    </>
  ),
  Antidotes: (
    <>
      <rect x="9.500" y="2.500" width="5" height="3" rx=".8" fill={C.woodDark} />
      <rect x="6" y="6" width="12" height="15.500" rx="2.500" fill={C.paper} stroke={C.metalLight} strokeWidth="1" />
      <path d="M12 10v7M8.500 13.500h7" stroke={C.green} strokeWidth="2.600" strokeLinecap="round" />
    </>
  ),
  Biofuel: (
    <>
      <path d="M6 7h8l4 3.500V20a1.500 1.500 0 0 1-1.500 1.500h-10A1.500 1.500 0 0 1 5 20V8a1 1 0 0 1 1-1Z" fill={C.greenDark} />
      <rect x="7" y="3.500" width="5" height="3.500" rx="1" fill={C.ink} />
      <path d="M15.500 5.500 18 8" stroke={C.ink} strokeWidth="1.800" strokeLinecap="round" />
      <path d="M11.500 11.500c1.800 2.200 3 3.700 3 5.200a3 3 0 0 1-6 0c0-1.500 1.200-3 3-5.200Z" fill={C.greenLight} />
    </>
  ),
  Catalyst: (
    <>
      <rect x="10" y="2.500" width="4" height="6" fill={C.glass} />
      <rect x="9" y="2.500" width="6" height="1.800" rx=".8" fill={C.woodDark} />
      <circle cx="12" cy="14.500" r="7" fill={C.glass} />
      <path d="M5.200 13h13.600a7 7 0 1 1-13.600 0Z" fill={C.purple} />
      <circle cx="10" cy="16.500" r="1.200" fill={C.purpleLight} />
      <circle cx="14" cy="15" r=".8" fill={C.purpleLight} />
      <circle cx="13" cy="10.500" r=".8" fill={C.purpleLight} />
    </>
  ),
  MetalParts: (
    <>
      <path d="M8 3.500 13 6.400v5.800L8 15 3 12.200V6.400Z" fill={C.metal} />
      <circle cx="8" cy="9.300" r="2.300" fill={C.metalDark} />
      <rect x="13" y="12" width="4.500" height="9.500" rx="1" fill={C.metalLight} />
      <rect x="11.500" y="10.500" width="7.500" height="3" rx="1" fill={C.metalDark} />
      <path d="M13 16h4.500M13 18.500h4.500" stroke={C.metal} strokeWidth="1" />
    </>
  ),
  Grease: (
    <>
      <rect x="4.500" y="8" width="15" height="13" rx="2" fill={C.metal} />
      <rect x="3.500" y="6" width="17" height="3.500" rx="1.200" fill={C.metalLight} />
      <path d="M9 9.500h7v3a1.500 1.500 0 0 1-3 0v-.5a1 1 0 0 0-2 0v4a1 1 0 0 1-2 0Z" fill={C.ink} />
    </>
  ),
  Coffee: (
    <>
      <path d="M8 2.500c-1 1.500 1 2.500 0 4M12 2.500c-1 1.500 1 2.500 0 4" stroke={C.metal} strokeWidth="1.400" strokeLinecap="round" fill="none" />
      <path d="M4 9h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" fill={C.paper} stroke={C.metalLight} strokeWidth="1" />
      <path d="M17 11h1.500a2.500 2.500 0 0 1 0 5H17" stroke={C.metalLight} strokeWidth="1.800" fill="none" />
      <rect x="5.500" y="10.500" width="10" height="2.500" rx="1" fill={C.woodDark} />
    </>
  ),
};

export const hasGoodIcon = (prefix: string) => prefix in ICONS;

/** Icon for a good, by its adapter prefix (e.g. "TreatedPlanks"). Decorative: pair it with the name. */
export function GoodIcon({ good, className }: { good: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6 shrink-0", className)}>
      {ICONS[good]}
    </svg>
  );
}
