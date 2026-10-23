import { createTheme } from '@vanilla-extract/css';
import { color } from 'folds';

const silverThemeData = {
  Background: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Surface: {
    Container: '#EAEAEA',
    ContainerHover: '#DEDEDE',
    ContainerActive: '#D3D3D3',
    ContainerLine: '#C7C7C7',
    OnContainer: '#000000',
  },

  SurfaceVariant: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Primary: {
    Main: '#1245A8',
    MainHover: '#103E97',
    MainActive: '#0F3B8F',
    MainLine: '#0E3786',
    OnMain: '#FFFFFF',
    Container: '#C4D0E9',
    ContainerHover: '#B8C7E5',
    ContainerActive: '#ACBEE1',
    ContainerLine: '#A0B5DC',
    OnContainer: '#0D3076',
  },

  Secondary: {
    Main: '#000000',
    MainHover: '#171717',
    MainActive: '#232323',
    MainLine: '#2F2F2F',
    OnMain: '#EAEAEA',
    Container: '#C7C7C7',
    ContainerHover: '#BBBBBB',
    ContainerActive: '#AFAFAF',
    ContainerLine: '#A4A4A4',
    OnContainer: '#0C0C0C',
  },

  Success: {
    Main: '#017343',
    MainHover: '#01683C',
    MainActive: '#016239',
    MainLine: '#015C36',
    OnMain: '#FFFFFF',
    Container: '#BFDCD0',
    ContainerHover: '#B3D5C7',
    ContainerActive: '#A6CEBD',
    ContainerLine: '#99C7B4',
    OnContainer: '#01512F',
  },

  Warning: {
    Main: '#864300',
    MainHover: '#793C00',
    MainActive: '#723900',
    MainLine: '#6B3600',
    OnMain: '#FFFFFF',
    Container: '#E1D0BF',
    ContainerHover: '#DBC7B2',
    ContainerActive: '#D5BDA6',
    ContainerLine: '#CFB499',
    OnContainer: '#5E2F00',
  },

  Critical: {
    Main: '#9D0F0F',
    MainHover: '#8D0E0E',
    MainActive: '#850D0D',
    MainLine: '#7E0C0C',
    OnMain: '#FFFFFF',
    Container: '#E7C3C3',
    ContainerHover: '#E2B7B7',
    ContainerActive: '#DDABAB',
    ContainerLine: '#D89F9F',
    OnContainer: '#6E0B0B',
  },

  Other: {
    FocusRing: 'rgba(0 0 0 / 50%)',
    Shadow: 'rgba(0 0 0 / 20%)',
    Overlay: 'rgba(0 0 0 / 50%)',
  },
};

export const silverTheme = createTheme(color, silverThemeData);

const darkThemeData = {
  Background: {
    Container: '#1A1A1A',
    ContainerHover: '#262626',
    ContainerActive: '#333333',
    ContainerLine: '#404040',
    OnContainer: '#F2F2F2',
  },

  Surface: {
    Container: '#262626',
    ContainerHover: '#333333',
    ContainerActive: '#404040',
    ContainerLine: '#4D4D4D',
    OnContainer: '#F2F2F2',
  },

  SurfaceVariant: {
    Container: '#333333',
    ContainerHover: '#404040',
    ContainerActive: '#4D4D4D',
    ContainerLine: '#595959',
    OnContainer: '#F2F2F2',
  },

  Primary: {
    Main: '#BDB6EC',
    MainHover: '#B2AAE9',
    MainActive: '#ADA3E8',
    MainLine: '#A79DE6',
    OnMain: '#2C2843',
    Container: '#413C65',
    ContainerHover: '#494370',
    ContainerActive: '#50497B',
    ContainerLine: '#575086',
    OnContainer: '#E3E1F7',
  },

  Secondary: {
    Main: '#FFFFFF',
    MainHover: '#E5E5E5',
    MainActive: '#D9D9D9',
    MainLine: '#CCCCCC',
    OnMain: '#1A1A1A',
    Container: '#404040',
    ContainerHover: '#4D4D4D',
    ContainerActive: '#595959',
    ContainerLine: '#666666',
    OnContainer: '#F2F2F2',
  },

  Success: {
    Main: '#85E0BA',
    MainHover: '#70DBAF',
    MainActive: '#66D9A9',
    MainLine: '#5CD6A3',
    OnMain: '#0F3D2A',
    Container: '#175C3F',
    ContainerHover: '#1A6646',
    ContainerActive: '#1C704D',
    ContainerLine: '#1F7A54',
    OnContainer: '#CCF2E2',
  },

  Warning: {
    Main: '#E3BA91',
    MainHover: '#DFAF7E',
    MainActive: '#DDA975',
    MainLine: '#DAA36C',
    OnMain: '#3F2A15',
    Container: '#5E3F20',
    ContainerHover: '#694624',
    ContainerActive: '#734D27',
    ContainerLine: '#7D542B',
    OnContainer: '#F3E2D1',
  },

  Critical: {
    Main: '#E69D9D',
    MainHover: '#E28D8D',
    MainActive: '#E08585',
    MainLine: '#DE7D7D',
    OnMain: '#401C1C',
    Container: '#602929',
    ContainerHover: '#6B2E2E',
    ContainerActive: '#763333',
    ContainerLine: '#803737',
    OnContainer: '#F5D6D6',
  },

  Other: {
    FocusRing: 'rgba(255, 255, 255, 0.5)',
    Shadow: 'rgba(0, 0, 0, 1)',
    Overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

export const darkTheme = createTheme(color, darkThemeData);

const violetThemeData = {
  Background: {
    Container: '#0A0A0C',
    ContainerHover: '#141418',
    ContainerActive: '#1C1C22',
    ContainerLine: '#26262E',
    OnContainer: '#E8E6F0',
  },

  Surface: {
    Container: '#141418',
    ContainerHover: '#1C1C22',
    ContainerActive: '#26262E',
    ContainerLine: '#303038',
    OnContainer: '#E8E6F0',
  },

  SurfaceVariant: {
    Container: '#0F0F12',
    ContainerHover: '#141418',
    ContainerActive: '#1C1C22',
    ContainerLine: '#26262E',
    OnContainer: '#E8E6F0',
  },

  Primary: {
    Main: '#8B5CF6',
    MainHover: '#7C3AED',
    MainActive: '#6D28D9',
    MainLine: '#5B21B6',
    OnMain: '#FFFFFF',
    Container: '#2D1B69',
    ContainerHover: '#35207A',
    ContainerActive: '#3D258B',
    ContainerLine: '#452B9C',
    OnContainer: '#D4C8FB',
  },

  Secondary: {
    Main: '#FFFFFF',
    MainHover: '#E8E6F0',
    MainActive: '#D5D2E3',
    MainLine: '#C2BED6',
    OnMain: '#0A0A0C',
    Container: '#26262E',
    ContainerHover: '#303038',
    ContainerActive: '#3A3A44',
    ContainerLine: '#444450',
    OnContainer: '#E8E6F0',
  },

  Success: {
    Main: '#23A55A',
    MainHover: '#27B863',
    MainActive: '#2CC96C',
    MainLine: '#32DA75',
    OnMain: '#FFFFFF',
    Container: '#0F3D20',
    ContainerHover: '#124825',
    ContainerActive: '#15522A',
    ContainerLine: '#185D2F',
    OnContainer: '#B8EDCC',
  },

  Warning: {
    Main: '#E8B44F',
    MainHover: '#EBBD62',
    MainActive: '#EDC674',
    MainLine: '#F0CE86',
    OnMain: '#0A0A0C',
    Container: '#4D3A15',
    ContainerHover: '#5C4419',
    ContainerActive: '#6B4E1D',
    ContainerLine: '#7A5821',
    OnContainer: '#F5E2C7',
  },

  Critical: {
    Main: '#DA373C',
    MainHover: '#E14D52',
    MainActive: '#E66367',
    MainLine: '#EB797D',
    OnMain: '#FFFFFF',
    Container: '#3D1113',
    ContainerHover: '#4A1517',
    ContainerActive: '#56191B',
    ContainerLine: '#631D1F',
    OnContainer: '#F8C7C9',
  },

  Other: {
    FocusRing: 'rgba(139, 92, 246, 0.5)',
    Shadow: 'rgba(0, 0, 0, 1)',
    Overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

export const violetTheme = createTheme(color, violetThemeData);

export const butterTheme = createTheme(color, {
  ...darkThemeData,
  Background: {
    Container: '#1A1916',
    ContainerHover: '#262621',
    ContainerActive: '#33322C',
    ContainerLine: '#403F38',
    OnContainer: '#FFFBDE',
  },

  Surface: {
    Container: '#262621',
    ContainerHover: '#33322C',
    ContainerActive: '#403F38',
    ContainerLine: '#4D4B43',
    OnContainer: '#FFFBDE',
  },

  SurfaceVariant: {
    Container: '#33322C',
    ContainerHover: '#403F38',
    ContainerActive: '#4D4B43',
    ContainerLine: '#59584E',
    OnContainer: '#FFFBDE',
  },

  Secondary: {
    Main: '#FFFBDE',
    MainHover: '#E5E2C8',
    MainActive: '#D9D5BD',
    MainLine: '#CCC9B2',
    OnMain: '#1A1916',
    Container: '#403F38',
    ContainerHover: '#4D4B43',
    ContainerActive: '#59584E',
    ContainerLine: '#666459',
    OnContainer: '#F2EED3',
  },
});

type Ramp = [string, string, string, string, string, string];

// Dark neutrals: each layer sits one step above the previous, like dark/butter.
const darkSurfaces = (r: Ramp, on: string) => ({
  Background: {
    Container: r[0],
    ContainerHover: r[1],
    ContainerActive: r[2],
    ContainerLine: r[3],
    OnContainer: on,
  },
  Surface: {
    Container: r[1],
    ContainerHover: r[2],
    ContainerActive: r[3],
    ContainerLine: r[4],
    OnContainer: on,
  },
  SurfaceVariant: {
    Container: r[2],
    ContainerHover: r[3],
    ContainerActive: r[4],
    ContainerLine: r[5],
    OnContainer: on,
  },
  Secondary: {
    ...darkThemeData.Secondary,
    Container: r[3],
    ContainerHover: r[4],
    ContainerActive: r[5],
    OnContainer: on,
  },
});

export const midnightTheme = createTheme(color, {
  ...darkThemeData,
  ...darkSurfaces(['#0F1624', '#172033', '#1F2A42', '#283551', '#314060', '#3A4B6F'], '#E6ECF7'),
  Primary: {
    Main: '#8AB4F8',
    MainHover: '#7AA8F6',
    MainActive: '#6E9FF5',
    MainLine: '#6296F3',
    OnMain: '#0B1E3D',
    Container: '#1E3A66',
    ContainerHover: '#224272',
    ContainerActive: '#264A7E',
    ContainerLine: '#2A528A',
    OnContainer: '#D6E4FC',
  },
  Other: { ...darkThemeData.Other, FocusRing: 'rgba(138, 180, 248, 0.5)' },
});

export const emeraldTheme = createTheme(color, {
  ...darkThemeData,
  ...darkSurfaces(['#0E1714', '#15211D', '#1C2B26', '#24362F', '#2C4139', '#344C43'], '#E3F2EC'),
  Primary: {
    Main: '#6EE7B7',
    MainHover: '#5EE0AD',
    MainActive: '#4FDAA3',
    MainLine: '#40D399',
    OnMain: '#053324',
    Container: '#0F4A35',
    ContainerHover: '#12553D',
    ContainerActive: '#156045',
    ContainerLine: '#186B4D',
    OnContainer: '#C9F5E3',
  },
  Other: { ...darkThemeData.Other, FocusRing: 'rgba(110, 231, 183, 0.5)' },
});

export const roseTheme = createTheme(color, {
  ...darkThemeData,
  ...darkSurfaces(['#1A1215', '#261A1F', '#332329', '#402C33', '#4D353D', '#5A3E47'], '#F7E6EC'),
  Primary: {
    Main: '#F4A6C0',
    MainHover: '#F296B5',
    MainActive: '#F087AA',
    MainLine: '#EE779F',
    OnMain: '#45152A',
    Container: '#6B2540',
    ContainerHover: '#772A48',
    ContainerActive: '#832F50',
    ContainerLine: '#8F3458',
    OnContainer: '#FBD9E5',
  },
  Other: { ...darkThemeData.Other, FocusRing: 'rgba(244, 166, 192, 0.5)' },
});

// Pure black for OLED screens, with the Zennith violet accent.
export const amoledTheme = createTheme(color, {
  ...violetThemeData,
  ...darkSurfaces(['#000000', '#0D0D0D', '#1A1A1A', '#262626', '#333333', '#404040'], '#F2F2F2'),
});

export const lavenderTheme = createTheme(color, {
  ...silverThemeData,
  Background: {
    Container: '#E9E4F5',
    ContainerHover: '#DFD8F0',
    ContainerActive: '#D4CCEA',
    ContainerLine: '#C9C0E4',
    OnContainer: '#1C1530',
  },
  Surface: {
    Container: '#F6F3FC',
    ContainerHover: '#E9E4F5',
    ContainerActive: '#DFD8F0',
    ContainerLine: '#D4CCEA',
    OnContainer: '#1C1530',
  },
  SurfaceVariant: {
    Container: '#E9E4F5',
    ContainerHover: '#DFD8F0',
    ContainerActive: '#D4CCEA',
    ContainerLine: '#C9C0E4',
    OnContainer: '#1C1530',
  },
  Primary: {
    Main: '#6D28D9',
    MainHover: '#6324C6',
    MainActive: '#5B21B6',
    MainLine: '#531EA6',
    OnMain: '#FFFFFF',
    Container: '#DDD0F7',
    ContainerHover: '#D2C2F4',
    ContainerActive: '#C7B4F1',
    ContainerLine: '#BCA6EE',
    OnContainer: '#3B1475',
  },
  Other: { ...silverThemeData.Other, FocusRing: 'rgba(109, 40, 217, 0.5)' },
});
