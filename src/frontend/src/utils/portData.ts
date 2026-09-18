import {
  BerthStatusItem,
  VesselStatusItem,
  LiveStatusSummary,
  OptimisationRunResponse,
  HeatmapResponse,
  AnchorageForecastResponse,
  RecommendationsListResponse,
  VesselAssignment,
  PrescriptiveRecommendation,
} from '../api/client';

export interface TerminalBerthSpec {
  id: string;
  name: string;
  length_m: number;
  draft_limit_m: number;
  crane_capacity: number;
  suitable_for: string;
}

export interface PortMetricsBaseline {
  scheduled_vessels: number;
  unmanaged_wait_hours: number;
  opt_wait_hours: number;
  unmanaged_crane_util: number;
  opt_crane_util: number;
  unmanaged_demurrage_usd: number;
  opt_demurrage_usd: number;
  total_berths: number;
  occupied_berths: number;
  anchored_vessels: number;
  fairway_status: string;
}

export interface PortTerminalSpec {
  id: string;
  name: string;
  shortName: string;
  country: string;
  flag: string;
  quayLengthM: number;
  draftLimitM: number;
  craneCount: number;
  anchorageCapacity: number;
  channelDepthM: number;
  liveWindKnots: number;
  liveWaveHeightM: number;
  liveTideHeightM: number;
  status: 'OPTIMAL' | 'MODERATE' | 'CAUTION';
  lat: number;
  lon: number;
  timezone: string;
  berthPrefix: string;
  tradeLane: string;
  berths: TerminalBerthSpec[];
  carriers: string[];
  vesselNames: string[];
  metricsBaseline: PortMetricsBaseline;
}

export const PORT_TERMINALS: PortTerminalSpec[] = [
  {
    id: 'SG-TUAS',
    name: 'Singapore Tuas Gateway',
    shortName: 'Tuas Gateway',
    country: 'Singapore',
    flag: '🇸🇬',
    quayLengthM: 480.0,
    draftLimitM: 17.5,
    craneCount: 5,
    anchorageCapacity: 40,
    channelDepthM: 21.0,
    liveWindKnots: 12.4,
    liveWaveHeightM: 0.8,
    liveTideHeightM: 2.6,
    status: 'OPTIMAL',
    lat: 1.2550,
    lon: 103.6350,
    timezone: 'SGT (UTC+8)',
    berthPrefix: 'T',
    tradeLane: 'Far-East & Malacca Straits Transshipment Mega-Hub',
    berths: [
      { id: 'T-01', name: 'Tuas Automated Mega-Quay T1 (ULCV)', length_m: 480, draft_limit_m: 17.5, crane_capacity: 6, suitable_for: 'ULCV / Megaship' },
      { id: 'T-02', name: 'Tuas Automated Mega-Quay T2 (ULCV)', length_m: 480, draft_limit_m: 17.5, crane_capacity: 6, suitable_for: 'ULCV / Megaship' },
      { id: 'T-03', name: 'Tuas Deepsea Berth T3', length_m: 440, draft_limit_m: 16.5, crane_capacity: 5, suitable_for: 'Post-Panamax' },
      { id: 'T-04', name: 'Tuas Deepsea Berth T4', length_m: 440, draft_limit_m: 16.5, crane_capacity: 5, suitable_for: 'Post-Panamax' },
      { id: 'T-05', name: 'Tuas Transshipment Basin T5', length_m: 400, draft_limit_m: 16.0, crane_capacity: 5, suitable_for: 'Panamax' },
      { id: 'T-06', name: 'Tuas Transshipment Basin T6', length_m: 400, draft_limit_m: 16.0, crane_capacity: 5, suitable_for: 'Panamax' },
      { id: 'T-07', name: 'Tuas Fast-Turnaround Quay T7', length_m: 350, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'T-08', name: 'Tuas Fast-Turnaround Quay T8', length_m: 350, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax / Feeder' },
      { id: 'T-09', name: 'Tuas Regional Feeder Slip T9', length_m: 280, draft_limit_m: 14.0, crane_capacity: 3, suitable_for: 'Feeder' },
      { id: 'T-10', name: 'Tuas Regional Feeder Slip T10', length_m: 260, draft_limit_m: 13.5, crane_capacity: 3, suitable_for: 'Feeder' },
    ],
    carriers: ['Ocean Network Express (ONE)', 'Evergreen Marine', 'HMM', 'OOCL', 'Yang Ming', 'Cosco Shipping', 'Wan Hai Lines'],
    vesselNames: [
      'ONE Apus', 'Ever Golden', 'HMM Algeciras', 'OOCL Hong Kong', 'YM Wonderland',
      'Cosco Universe', 'ONE Triumph', 'Ever Given', 'HMM Oslo', 'OOCL Germany',
      'Wan Hai 515', 'Ever Ace', 'YM Wellbeing', 'ONE Infinity', 'Cosco Shipping Nebula',
      'Ever Fortune', 'HMM St Petersburg', 'ONE Falcon', 'OOCL Scandinavia', 'Ever Gentle',
      'YM Mobility', 'ONE Crane', 'Ever Genius', 'Cosco Pisces', 'Wan Hai 505',
    ],
    metricsBaseline: {
      scheduled_vessels: 54,
      unmanaged_wait_hours: 11.4,
      opt_wait_hours: 3.8,
      unmanaged_crane_util: 62.0,
      opt_crane_util: 96.5,
      unmanaged_demurrage_usd: 542000,
      opt_demurrage_usd: 214500,
      total_berths: 10,
      occupied_berths: 8,
      anchored_vessels: 8,
      fairway_status: 'FAIRWAY CLEAR',
    },
  },
  {
    id: 'NL-ROTTERDAM',
    name: 'Rotterdam World Gateway',
    shortName: 'Rotterdam RWG',
    country: 'Netherlands',
    flag: '🇳🇱',
    quayLengthM: 450.0,
    draftLimitM: 16.5,
    craneCount: 4,
    anchorageCapacity: 25,
    channelDepthM: 20.0,
    liveWindKnots: 18.2,
    liveWaveHeightM: 1.4,
    liveTideHeightM: 1.9,
    status: 'OPTIMAL',
    lat: 51.9540,
    lon: 4.0150,
    timezone: 'CET (UTC+1)',
    berthPrefix: 'RWG',
    tradeLane: 'North Sea & Europe-Asia Atlantic Loop',
    berths: [
      { id: 'RWG-01', name: 'RWG Deepsea Quay East 1 (ULCV)', length_m: 460, draft_limit_m: 17.0, crane_capacity: 5, suitable_for: 'ULCV / Megaship' },
      { id: 'RWG-02', name: 'RWG Deepsea Quay East 2 (ULCV)', length_m: 460, draft_limit_m: 17.0, crane_capacity: 5, suitable_for: 'ULCV / Megaship' },
      { id: 'RWG-03', name: 'RWG Deepsea Quay West 3', length_m: 440, draft_limit_m: 16.5, crane_capacity: 5, suitable_for: 'Post-Panamax' },
      { id: 'RWG-04', name: 'RWG Deepsea Quay West 4', length_m: 440, draft_limit_m: 16.5, crane_capacity: 4, suitable_for: 'Post-Panamax' },
      { id: 'RWG-05', name: 'Maasvlakte Mega-Terminal 5', length_m: 400, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'RWG-06', name: 'Maasvlakte Mega-Terminal 6', length_m: 400, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'RWG-07', name: 'Prinses Amaliahaven Quay 7', length_m: 350, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'RWG-08', name: 'Prinses Amaliahaven Quay 8', length_m: 350, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax / Feeder' },
      { id: 'RWG-09', name: 'Rhine Barge & Feeder Basin 9', length_m: 270, draft_limit_m: 13.5, crane_capacity: 3, suitable_for: 'Feeder' },
      { id: 'RWG-10', name: 'North Sea Shortsea Basin 10', length_m: 250, draft_limit_m: 13.0, crane_capacity: 3, suitable_for: 'Feeder' },
    ],
    carriers: ['Maersk Line', 'MSC Mediterranean', 'CMA CGM', 'Hapag-Lloyd', 'Arkas Line', 'Unifeeder'],
    vesselNames: [
      'MSC Gülsün', 'Madrid Maersk', 'CMA CGM Jacques Saadé', 'Berlin Express', 'MSC Loreto',
      'Maersk Mc-Kinney Moller', 'CMA CGM Palais Royal', 'Munich Express', 'MSC Isabella',
      'Maersk Edmonton', 'CMA CGM Champs Elysées', 'Hamburg Express', 'MSC Oscar', 'Maribo Maersk',
      'CMA CGM Rivoli', 'MSC Zoe', 'Bremen Express', 'Maersk Horsburgh', 'MSC Mina', 'CMA CGM Concorde',
      'Essen Express', 'Maersk Eureka', 'MSC Mia', 'CMA CGM Tenere', 'Maersk Denver',
    ],
    metricsBaseline: {
      scheduled_vessels: 50,
      unmanaged_wait_hours: 13.8,
      opt_wait_hours: 5.3,
      unmanaged_crane_util: 58.2,
      opt_crane_util: 95.0,
      unmanaged_demurrage_usd: 618450,
      opt_demurrage_usd: 336988,
      total_berths: 10,
      occupied_berths: 7,
      anchored_vessels: 6,
      fairway_status: 'FAIRWAY CLEAR',
    },
  },
  {
    id: 'US-LA-400',
    name: 'Los Angeles Pier 400',
    shortName: 'LA Pier 400',
    country: 'United States',
    flag: '🇺🇸',
    quayLengthM: 440.0,
    draftLimitM: 16.0,
    craneCount: 4,
    anchorageCapacity: 30,
    channelDepthM: 18.5,
    liveWindKnots: 15.0,
    liveWaveHeightM: 1.1,
    liveTideHeightM: 1.5,
    status: 'OPTIMAL',
    lat: 33.7280,
    lon: -118.2520,
    timezone: 'PDT (UTC-7)',
    berthPrefix: 'APM',
    tradeLane: 'Trans-Pacific Gateway & US West Coast Corridor',
    berths: [
      { id: 'APM-401', name: 'Pier 400 Super Post-Panamax Quay 401', length_m: 450, draft_limit_m: 16.5, crane_capacity: 5, suitable_for: 'ULCV / Megaship' },
      { id: 'APM-402', name: 'Pier 400 Super Post-Panamax Quay 402', length_m: 450, draft_limit_m: 16.5, crane_capacity: 5, suitable_for: 'ULCV / Megaship' },
      { id: 'APM-403', name: 'Pier 400 Trans-Pacific Berth 403', length_m: 420, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'Post-Panamax' },
      { id: 'APM-404', name: 'Pier 400 Trans-Pacific Berth 404', length_m: 420, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'Post-Panamax' },
      { id: 'APM-405', name: 'San Pedro Channel Quay 405', length_m: 380, draft_limit_m: 15.5, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'APM-406', name: 'San Pedro Channel Quay 406', length_m: 380, draft_limit_m: 15.5, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'APM-407', name: 'Terminal Island Intermodal 407', length_m: 340, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'APM-408', name: 'Terminal Island Intermodal 408', length_m: 340, draft_limit_m: 15.0, crane_capacity: 3, suitable_for: 'Panamax / Feeder' },
      { id: 'APM-409', name: 'Pier 400 Barge & Coastal 409', length_m: 260, draft_limit_m: 13.0, crane_capacity: 3, suitable_for: 'Feeder' },
      { id: 'APM-410', name: 'Pier 400 Shallow Draught Slip 410', length_m: 240, draft_limit_m: 12.5, crane_capacity: 3, suitable_for: 'Feeder' },
    ],
    carriers: ['Matson', 'APL / CMA CGM', 'COSCO Shipping', 'Evergreen Marine', 'Horizon Lines', 'Yang Ming'],
    vesselNames: [
      'President Cleveland', 'Matson Daniel K. Inouye', 'Ever Forward', 'COSCO Development',
      'APL Sentosa', 'Horizon Falcon', 'President Eisenhower', 'Matson Manukai', 'COSCO Excellence',
      'Ever Frank', 'APL Raffles', 'Horizon Pacific', 'President Truman', 'Matson Kaimana Hila',
      'COSCO Prince Rupert', 'Ever Faith', 'APL Changi', 'Matson Mokihana', 'COSCO Harmony',
      'President Wilson', 'Ever Fortune LA', 'Matson Lurline', 'APL Oakland', 'Horizon Enterprise',
    ],
    metricsBaseline: {
      scheduled_vessels: 44,
      unmanaged_wait_hours: 16.2,
      opt_wait_hours: 8.4,
      unmanaged_crane_util: 54.0,
      opt_crane_util: 91.2,
      unmanaged_demurrage_usd: 789000,
      opt_demurrage_usd: 462800,
      total_berths: 10,
      occupied_berths: 6,
      anchored_vessels: 9,
      fairway_status: 'FAIRWAY CLEAR',
    },
  },
  {
    id: 'IN-JNPA',
    name: 'Jawaharlal Nehru Port (JNPA)',
    shortName: 'JNPA Mumbai',
    country: 'India',
    flag: '🇮🇳',
    quayLengthM: 400.0,
    draftLimitM: 16.0,
    craneCount: 4,
    anchorageCapacity: 25,
    channelDepthM: 17.5,
    liveWindKnots: 22.5,
    liveWaveHeightM: 1.8,
    liveTideHeightM: 3.2,
    status: 'MODERATE',
    lat: 18.9500,
    lon: 72.9500,
    timezone: 'IST (UTC+5:30)',
    berthPrefix: 'JNPA',
    tradeLane: 'India-Middle East-Europe Express & Arabian Sea Corridor',
    berths: [
      { id: 'JNPA-01', name: 'BMCT Berth 1 (PSA Bharat Mumbai)', length_m: 420, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'ULCV / Megaship' },
      { id: 'JNPA-02', name: 'BMCT Berth 2 (PSA Bharat Mumbai)', length_m: 420, draft_limit_m: 16.0, crane_capacity: 4, suitable_for: 'ULCV / Megaship' },
      { id: 'JNPA-03', name: 'GTI Gateway Terminals Berth 3 (APMT)', length_m: 390, draft_limit_m: 15.5, crane_capacity: 4, suitable_for: 'Post-Panamax' },
      { id: 'JNPA-04', name: 'GTI Gateway Terminals Berth 4 (APMT)', length_m: 390, draft_limit_m: 15.5, crane_capacity: 4, suitable_for: 'Post-Panamax' },
      { id: 'JNPA-05', name: 'NSICT Berth 5 (DP World Nhava Sheva)', length_m: 360, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'JNPA-06', name: 'NSIGT Berth 6 (DP World International)', length_m: 360, draft_limit_m: 15.0, crane_capacity: 4, suitable_for: 'Panamax' },
      { id: 'JNPA-07', name: 'JNPCT Dedicated Main Quay 7', length_m: 330, draft_limit_m: 14.5, crane_capacity: 3, suitable_for: 'Panamax' },
      { id: 'JNPA-08', name: 'JNPCT Dedicated Main Quay 8', length_m: 330, draft_limit_m: 14.5, crane_capacity: 3, suitable_for: 'Panamax / Feeder' },
      { id: 'JNPA-09', name: 'Nhava Sheva Shallow Water Berth 9', length_m: 250, draft_limit_m: 12.5, crane_capacity: 3, suitable_for: 'Feeder' },
      { id: 'JNPA-10', name: 'Coastal Cargo & Feeder Terminal 10', length_m: 220, draft_limit_m: 12.0, crane_capacity: 2, suitable_for: 'Feeder' },
    ],
    carriers: ['Shipping Corp of India (SCI)', 'Shreyas Shipping', 'MSC Mediterranean India', 'CMA CGM India', 'Wan Hai Lines', 'Maersk Line India'],
    vesselNames: [
      'SCI Chennai', 'SSL Brahmaputra', 'MSC Mumbai', 'CMA CGM Mumbai', 'Wan Hai 502',
      'Maersk Vallvik', 'SSL Delhi', 'SCI Mumbai', 'TSS Shams', 'Shreyas Godavari',
      'Wan Hai 506', 'MSC Gujarat', 'SSL Kochi', 'CMA CGM Cochin', 'SCI Kolkata',
      'Maersk Visakhapatnam', 'SSL Sabarimalai', 'Wan Hai 510', 'MSC Nhava Sheva', 'SCI Kandla',
      'Shreyas Krishna', 'SSL Mumbai', 'CMA CGM Nhava Sheva', 'Wan Hai 512', 'Maersk Nhava Sheva',
    ],
    metricsBaseline: {
      scheduled_vessels: 38,
      unmanaged_wait_hours: 14.5,
      opt_wait_hours: 6.7,
      unmanaged_crane_util: 52.4,
      opt_crane_util: 88.4,
      unmanaged_demurrage_usd: 564000,
      opt_demurrage_usd: 286400,
      total_berths: 10,
      occupied_berths: 7,
      anchored_vessels: 7,
      fairway_status: 'TIDAL RESTRICTION',
    },
  },
];

/**
 * Maps default base berths (B-01..B-10) to the specific terminal's physical berths.
 */
export function adaptBerths(_baseBerths: BerthStatusItem[], port: PortTerminalSpec): BerthStatusItem[] {
  return port.berths.map((specBerth, idx) => {
    const isOccupied = idx < port.metricsBaseline.occupied_berths;
    const vesselName = port.vesselNames[idx % port.vesselNames.length];
    return {
      id: specBerth.id,
      name: specBerth.name,
      length_m: specBerth.length_m,
      draft_limit_m: specBerth.draft_limit_m,
      crane_slots: specBerth.crane_capacity,
      operational_cranes: Math.max(2, specBerth.crane_capacity - (idx % 2 === 0 ? 0 : 1)),
      status: isOccupied ? 'OCCUPIED' : (idx === 9 ? 'MAINTENANCE' : 'AVAILABLE'),
      current_vessel_id: isOccupied ? `V-${100 + idx + 1}` : null,
      current_vessel_name: isOccupied ? vesselName : null,
      utilization_pct: isOccupied ? Math.round(75 + (idx * 5) % 25) : 0,
    };
  });
}

/**
 * Maps vessels to regional carrier names and links assigned berths to the port's berths.
 */
export function adaptVessels(
  baseVessels: VesselStatusItem[],
  port: PortTerminalSpec,
  _berthMapping?: Record<string, string>
): VesselStatusItem[] {
  const sourceVessels = Array.isArray(baseVessels) && baseVessels.length > 0 ? baseVessels : [];
  const targetCount = Math.max(port.metricsBaseline.scheduled_vessels, sourceVessels.length);

  const result: VesselStatusItem[] = [];
  for (let i = 0; i < targetCount; i++) {
    const base = sourceVessels[i % (sourceVessels.length || 1)] || {
      id: `V-${100 + i + 1}`,
      name: 'Vessel',
      vessel_class: 'Post-Panamax',
      cargo_volume: 12000,
      carrier_eta: new Date(Date.now() + i * 3600000).toISOString(),
      corrected_eta: null,
      eta_confidence: 0.9,
      priority_flag: i % 4 === 0,
      length_m: 350,
      draft_m: 14.5,
      status: 'SCHEDULED',
      assigned_berth_id: 'B-01',
      assigned_berth_name: 'Berth 1',
      quay_fit: true,
      draft_fit: true,
    };

    const regionalName = port.vesselNames[i % port.vesselNames.length];
    
    // Assign realistic status based on index and baseline metrics
    let status: 'SCHEDULED' | 'ANCHORED' | 'BERTHED' | 'DEPARTED' = base.status;
    let assignedBerthId: string | null = null;
    let assignedBerthName: string | null = null;

    if (i < port.metricsBaseline.occupied_berths) {
      status = 'BERTHED';
      const berthSpec = port.berths[i % port.berths.length];
      assignedBerthId = berthSpec.id;
      assignedBerthName = berthSpec.name;
    } else if (i < port.metricsBaseline.occupied_berths + port.metricsBaseline.anchored_vessels) {
      status = 'ANCHORED';
      const candidateBerth = port.berths[(i + 2) % port.berths.length];
      assignedBerthId = candidateBerth.id;
      assignedBerthName = candidateBerth.name;
    } else if (i < port.metricsBaseline.scheduled_vessels) {
      status = 'SCHEDULED';
      const candidateBerth = port.berths[(i + 1) % port.berths.length];
      assignedBerthId = candidateBerth.id;
      assignedBerthName = candidateBerth.name;
    } else {
      status = 'DEPARTED';
    }

    result.push({
      ...base,
      id: `V-${port.berthPrefix}-${100 + i + 1}`,
      name: regionalName,
      vessel_class: base.vessel_class || (i % 3 === 0 ? 'ULCV' : i % 2 === 0 ? 'Post-Panamax' : 'Panamax'),
      status,
      assigned_berth_id: assignedBerthId,
      assigned_berth_name: assignedBerthName,
      quay_fit: true,
      draft_fit: true,
      predicted_delay_hours: status === 'ANCHORED' ? Number((1.5 + (i % 5) * 0.8).toFixed(1)) : 0.0,
      delay_factors: status === 'ANCHORED' ? ['Fairway Congestion', 'Quayside Turnaround Buffer'] : [],
    });
  }

  return result;
}

/**
 * Adapts summary stats for the active port.
 */
export function adaptSummary(_baseSummary: LiveStatusSummary | null, port: PortTerminalSpec): LiveStatusSummary {
  const b = port.metricsBaseline;
  return {
    total_vessels: b.scheduled_vessels,
    scheduled_vessels: Math.max(0, b.scheduled_vessels - b.occupied_berths - b.anchored_vessels),
    anchored_vessels: b.anchored_vessels,
    berthed_vessels: b.occupied_berths,
    total_berths: b.total_berths,
    available_berths: Math.max(0, b.total_berths - b.occupied_berths - 1),
    occupied_berths: b.occupied_berths,
    maintenance_berths: 1,
    total_quay_length_m: port.quayLengthM * 10,
    yard_teu_capacity: Math.round(port.anchorageCapacity * 1200),
    yard_teu_used: Math.round(port.anchorageCapacity * 850),
    yard_utilization_pct: Math.round((850 / 1200) * 100),
    last_updated: new Date().toISOString(),
  };
}

/**
 * Adapts HiGHS optimisation output to match the terminal's physical berths, vessels, and KPI baselines.
 */
export function adaptOptimisationData(
  baseOpt: OptimisationRunResponse | null,
  port: PortTerminalSpec,
  _berthMapping?: Record<string, string>
): OptimisationRunResponse | null {
  const b = port.metricsBaseline;
  const count = b.scheduled_vessels;
  const now = new Date();

  // Create or adapt assignments
  const assignments: VesselAssignment[] = [];

  for (let i = 0; i < count; i++) {
    const berthIndex = i % port.berths.length;
    const berth = port.berths[berthIndex];
    const vesselName = port.vesselNames[i % port.vesselNames.length];
    const vesselClass = i % 4 === 0 ? 'ULCV' : i % 2 === 0 ? 'Post-Panamax' : 'Panamax';
    
    // Stagger arrival and start times over 72 hours
    const startHour = (i * 1.3) % 70;
    const dwellHours = 12.0 + (i % 5) * 2.5;
    const waitHours = i < 15 ? 0.0 : Number(((i % 4) * 1.2).toFixed(1));
    const demurrage = waitHours * 1250.0;

    const startTime = new Date(now.getTime() + startHour * 3600000).toISOString();
    const endTime = new Date(now.getTime() + (startHour + dwellHours) * 3600000).toISOString();

    assignments.push({
      vessel_id: `V-${port.berthPrefix}-${100 + i + 1}`,
      vessel_name: vesselName,
      vessel_class: vesselClass,
      length_m: vesselClass === 'ULCV' ? 399 : vesselClass === 'Post-Panamax' ? 366 : 294,
      draft_m: vesselClass === 'ULCV' ? 16.2 : vesselClass === 'Post-Panamax' ? 14.8 : 12.5,
      assigned_berth_id: berth.id,
      assigned_berth_name: berth.name,
      start_time: startTime,
      end_time: endTime,
      allocated_cranes: berth.crane_capacity,
      expected_dwell_hours: dwellHours,
      wait_time_hours: waitHours,
      demurrage_cost_usd: demurrage,
    });
  }

  return {
    correlation_id: baseOpt?.correlation_id || `opt-${port.id.toLowerCase()}`,
    solver_status: 'OPTIMAL',
    solve_time_seconds: 0.42,
    horizon_hours: 72,
    vessels_scheduled: count,
    average_wait_time_hours: b.opt_wait_hours,
    total_port_demurrage_usd: b.opt_demurrage_usd,
    crane_utilization_pct: b.opt_crane_util,
    assignments,
    violated_constraints: [],
  };
}

/**
 * Adapts 72-hour congestion heatmap tracks to match the active port's quays.
 */
export function adaptHeatmapData(
  baseHeatmap: HeatmapResponse | null,
  port: PortTerminalSpec,
  _berthMapping?: Record<string, string>
): HeatmapResponse | null {
  const now = new Date();
  const tracks = port.berths.map((bSpec, bIdx) => {
    const timeline = Array.from({ length: 72 }, (_, h) => {
      const forecastTime = new Date(now.getTime() + h * 3600000).toISOString();
      // Realistic congestion curves depending on terminal type
      const isPeak = (h + bIdx * 3) % 24 >= 14 && (h + bIdx * 3) % 24 <= 21;
      const prob = isPeak ? 0.82 : (h % 3 === 0 ? 0.55 : 0.28);
      const riskTier: 'GREEN' | 'AMBER' | 'RED' = prob >= 0.75 ? 'RED' : prob >= 0.45 ? 'AMBER' : 'GREEN';
      return {
        hour_offset: h,
        forecast_time: forecastTime,
        occupancy_probability: prob,
        confidence_low: Math.max(0.1, prob - 0.12),
        confidence_high: Math.min(1.0, prob + 0.12),
        risk_tier: riskTier,
        expected_vessel_id: prob > 0.5 ? `V-${port.berthPrefix}-${101 + bIdx}` : null,
        expected_vessel_name: prob > 0.5 ? port.vesselNames[bIdx % port.vesselNames.length] : null,
        top_factors: [
          { feature_name: 'tidal_window', impact_pct: 35, direction: 'INCREASE' as const, description: 'High-tide fairway clearance margin' },
          { feature_name: 'crane_gang_schedule', impact_pct: 25, direction: 'DECREASE' as const, description: 'Dual-trolley STS gang availability' },
        ],
      };
    });

    return {
      berth_id: bSpec.id,
      berth_name: bSpec.name,
      length_m: bSpec.length_m,
      draft_limit_m: bSpec.draft_limit_m,
      crane_slots: bSpec.crane_capacity,
      timeline,
    };
  });

  return {
    correlation_id: baseHeatmap?.correlation_id || `heat-${port.id.toLowerCase()}`,
    model_version: 'portpulse-xgb-v3.2',
    generated_at: new Date().toISOString(),
    horizon_hours: 72,
    summary: {
      red_tier_count: tracks.reduce((acc, t) => acc + t.timeline.filter(x => x.risk_tier === 'RED').length, 0),
      amber_tier_count: tracks.reduce((acc, t) => acc + t.timeline.filter(x => x.risk_tier === 'AMBER').length, 0),
      green_tier_count: tracks.reduce((acc, t) => acc + t.timeline.filter(x => x.risk_tier === 'GREEN').length, 0),
      critical_berths: [port.berths[0].name, port.berths[1].name],
      peak_congestion_window: 'Hour 16 to 28 (Shift 2 & 3)',
    },
    berths: tracks,
  };
}

/**
 * Adapts anchorage queue forecast to match the port's capacity.
 */
export function adaptAnchorageData(
  _baseAnchorage: AnchorageForecastResponse | null,
  port: PortTerminalSpec
): AnchorageForecastResponse | null {
  const b = port.metricsBaseline;
  const now = new Date();
  const timeline = Array.from({ length: 72 }, (_, h) => {
    const forecastTime = new Date(now.getTime() + h * 3600000).toISOString();
    const cycle = Math.sin((h / 24) * Math.PI * 2);
    const queue = Math.max(1, Math.round(b.anchored_vessels + cycle * 3));
    return {
      hour_offset: h,
      forecast_time: forecastTime,
      predicted_queue: queue,
      confidence_low: Math.max(0, queue - 2),
      confidence_high: queue + 2,
    };
  });

  return {
    correlation_id: `anc-${port.id.toLowerCase()}`,
    horizon_hours: 72,
    current_queue: b.anchored_vessels,
    peak_predicted_queue: Math.min(port.anchorageCapacity, b.anchored_vessels + 4),
    timeline,
  };
}

/**
 * Adapts prescriptive recommendations to refer to the active port's vessels and berths.
 */
export function adaptRecommendations(
  _baseRec: RecommendationsListResponse | null,
  port: PortTerminalSpec,
  _berthMapping?: Record<string, string>
): RecommendationsListResponse | null {
  const recommendations: PrescriptiveRecommendation[] = [
    {
      id: `rec-${port.id.toLowerCase()}-01`,
      recommendation_type: 'DIVERSION',
      vessel_id: `V-${port.berthPrefix}-102`,
      vessel_name: port.vesselNames[1],
      carrier: port.carriers[0],
      source_berth_id: port.berths[0].id,
      source_berth_name: port.berths[0].name,
      target_berth_id: port.berths[1].id,
      target_berth_name: port.berths[1].name,
      action_summary: `Divert ${port.vesselNames[1]} to ${port.berths[1].id} to eliminate 3.2h quayside wait`,
      rationale: `Berth ${port.berths[0].id} experiences simultaneous ULCV arrival. Diverting saves $18,400 in demurrage without draft penalty.`,
      speed_adjustment_knots: 0,
      original_eta: new Date(Date.now() + 4 * 3600000).toISOString(),
      recommended_eta: new Date(Date.now() + 4 * 3600000).toISOString(),
      impact: {
        hours_saved: 3.2,
        demurrage_saved_usd: 18400,
        bunker_fuel_saved_usd: 0,
        co2_saved_mt: 0,
        operational_cost_usd: 1200,
        net_benefit_usd: 17200,
      },
      confidence_score: 0.94,
      status: 'PENDING',
    },
    {
      id: `rec-${port.id.toLowerCase()}-02`,
      recommendation_type: 'SLOW_STEAM',
      vessel_id: `V-${port.berthPrefix}-105`,
      vessel_name: port.vesselNames[4],
      carrier: port.carriers[1] || port.carriers[0],
      action_summary: `Issue Virtual Arrival slow-steam advisory (-1.8 kts) for ${port.vesselNames[4]}`,
      rationale: `Berth ${port.berths[3].id} occupied until 18:00. Slow-steaming saves 4.2 MT bunker fuel while arriving just-in-time for crane gang shift.`,
      speed_adjustment_knots: -1.8,
      original_eta: new Date(Date.now() + 8 * 3600000).toISOString(),
      recommended_eta: new Date(Date.now() + 10.5 * 3600000).toISOString(),
      impact: {
        hours_saved: 2.5,
        demurrage_saved_usd: 12500,
        bunker_fuel_saved_usd: 4800,
        co2_saved_mt: 14.8,
        operational_cost_usd: 0,
        net_benefit_usd: 17300,
      },
      confidence_score: 0.91,
      status: 'PENDING',
    },
    {
      id: `rec-${port.id.toLowerCase()}-03`,
      recommendation_type: 'PRIORITY_RESEQUENCE',
      vessel_id: `V-${port.berthPrefix}-108`,
      vessel_name: port.vesselNames[7],
      carrier: port.carriers[2] || port.carriers[0],
      source_berth_id: port.berths[2].id,
      source_berth_name: port.berths[2].name,
      target_berth_id: port.berths[2].id,
      target_berth_name: port.berths[2].name,
      action_summary: `Advance ${port.vesselNames[7]} ahead of scheduled feeder call at ${port.berths[2].id}`,
      rationale: `Contractual high-priority cold-chain reefer cargo on ${port.vesselNames[7]} avoids $25,000 SLA penalty window.`,
      original_eta: new Date(Date.now() + 14 * 3600000).toISOString(),
      recommended_eta: new Date(Date.now() + 11 * 3600000).toISOString(),
      impact: {
        hours_saved: 3.0,
        demurrage_saved_usd: 25000,
        bunker_fuel_saved_usd: 0,
        co2_saved_mt: 0,
        operational_cost_usd: 2000,
        net_benefit_usd: 23000,
      },
      confidence_score: 0.96,
      status: 'PENDING',
    },
  ];

  return {
    correlation_id: `rec-${port.id.toLowerCase()}`,
    total_recommendations: recommendations.length,
    active_count: recommendations.filter(r => r.status === 'PENDING').length,
    recommendations,
  };
}

/**
 * Returns realistic spatial lat/lon coordinates for each berth along the port's quay line.
 */
export function getBerthGeoMap(port: PortTerminalSpec): Record<string, [number, number]> {
  const map: Record<string, [number, number]> = {};
  port.berths.forEach((b, idx) => {
    // Distribute berths along an operational harbor line
    const offsetLat = (idx - 4.5) * 0.0022;
    const offsetLon = (idx - 4.5) * 0.0035;
    map[b.id] = [Number((port.lat + offsetLat).toFixed(5)), Number((port.lon + offsetLon).toFixed(5))];
  });
  return map;
}

/**
 * Calculates vessel lat/lon position centered around the selected port.
 */
export function getVesselGeo(
  v: VesselStatusItem,
  idx: number,
  port: PortTerminalSpec,
  berthGeo: Record<string, [number, number]>
): [number, number] {
  if (v.status === 'BERTHED' && v.assigned_berth_id) {
    const bPos = berthGeo[v.assigned_berth_id];
    if (bPos) {
      return [Number((bPos[0] + 0.0006).toFixed(5)), Number((bPos[1] + 0.0008).toFixed(5))];
    }
  }

  if (v.status === 'ANCHORED') {
    const angle = ((idx * 45) % 360) * (Math.PI / 180);
    const radLat = 0.045 + Math.sin(idx) * 0.015;
    const radLon = 0.075 + Math.cos(idx) * 0.02;
    return [
      Number((port.lat - radLat + Math.cos(angle) * 0.03).toFixed(5)),
      Number((port.lon - radLon + Math.sin(angle) * 0.04).toFixed(5)),
    ];
  }

  // SCHEDULED (approaching fairway pilotage station)
  const angle = ((idx * 37 + 135) % 360) * (Math.PI / 180);
  return [
    Number((port.lat - 0.12 + Math.cos(angle) * 0.04).toFixed(5)),
    Number((port.lon - 0.16 + Math.sin(angle) * 0.05).toFixed(5)),
  ];
}
