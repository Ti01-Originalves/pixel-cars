import { CustomCarAccessoryConfig } from '@/data/carTemplates';

export interface CustomCarAccessoryConfig {
  id: string;
  description: string;
  generateFront: (width: number, height: number) => string;
  generateRear: (width: number, height: number) => string;
  generateLeft: (width: number, height: number) => string;
  generateRight: (width: number, height: number) => string;
  generateTop: (width: number, height: number) => string;
  primaryColor: string;
  secondaryColor: string;
  shadingMode: 'primary' | 'secondary' | 'outline' | 'gradient';
  specs: {
    wheels: number;
    engineType: 'v8' | 'v10' | 'v12' | 'inline-6' | 'v4';
    power: number;
    topSpeed: number;
  };
}

const CAR_PRESETS: CustomCarAccessoryConfig[] = [
  {
    id: 'skyline_r34',
    description: '1969 FORD MUSTANG FASTBACK (ELEANOR - MUSCLE)\n  • Twin-turbo V8 engine producing 850HP\n  • 4.0L displacement with custom exhaust\n  • 5-speed manual transmission\n  • Iconic red paint with white racing stripes\n  • Shaved rear window for authentic 1969 styling',
  generateFront: (width, height) => `  ◧ ◧   ◧\n  |  |   |  |`,
  generateRear: (width, height) => `  ◧◧◧\n   | |  \n   |||`,
  generateLeft: (width, height) => `  ◧ | |   ◧\n  |  |   |  |`,
  generateRight: (width, height) => `  |  |   |  |  ◧\n  |  |   |  |`,
  generateTop: (width, height) => `  ||||||||||||||| \n  |  |   |  |  |  |`,
  primaryColor: '#ff4500',
  secondaryColor: '#000000',
  shadingMode: 'primary',
  specs: { wheels: 4, engineType: 'v8', power: 850, topSpeed: 280 }
},
  {
    id: 'bmw_m3_gtr',
    description: '2015 BMW M3 GTR (Nürburgring Edition)\n  • 4.4L inline-6 engine with twin turbo\n  • 625HP with carbon fiber body kit\n  • 6-speed sequential racing transmission\n  • Alpine White with British Racing Green accents\n  • Nürburgring-specific aerodynamic package',
  generateFront: (width, height) => `  ┌───────┐\n  │  █   │\n  │ ███  │\n  │█ ███│\n  │█ █ █│\n  └───────┘`,
  generateRear: (width, height) => `  ███\n   █ █\n    █\n   █ █\n  █   █`,
  generateLeft: (width, height) => `  █ | █ | █\n  █ █ █ █ | █\n   █ █   █ █\n    █ █ █ █ | █\n  █  █   █  █`,
  generateRight: (width, height) => `  | █  |  █ | █\n  | ███ | ███ | █\n  |   █   |   █ | █\n   █ █ | █ █   | █\n  █  █   █  █  █`,
  generateTop: (width, height) => `  ███ █ █ █\n   █ █ █ █ █ █\n    █ █ █ █ █  \n   █   █ █ █  \n   █  █ █ █  █`,
  primaryColor: '#ffffff',
  secondaryColor: '#008000',
  shadingMode: 'gradient',
  specs: { wheels: 4, engineType: 'inline-6', power: 625, topSpeed: 265 }
},
  // ... continue with all other presets ...
];