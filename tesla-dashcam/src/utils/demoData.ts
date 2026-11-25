import { CORE_CAMERAS, DashcamEvent, VideoSegment } from '../types/dashcam';

function makeDemoSegments(baseDate: Date, count: number, segSec = 60): VideoSegment[] {
  return Array.from({ length: count }, (_, idx) => {
    const startDate = new Date(baseDate.getTime() + idx * segSec * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(
      startDate.getDate()
    )}_${pad(startDate.getHours())}-${pad(startDate.getMinutes())}-${pad(
      startDate.getSeconds()
    )}`;
    return {
      id: `demo-seg-${key}`,
      timestampKey: key,
      startDate,
      duration: segSec,
      cameras: {},
    };
  });
}

export function createDemoEvents(): DashcamEvent[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sentryDate = new Date(today.getTime() - 6 * 3600 * 1000 + 42 * 60 * 1000);
  const highwayDate = new Date(today.getTime() - 10 * 3600 * 1000 + 18 * 60 * 1000);
  const nightDate = new Date(today.getTime() - 27 * 3600 * 1000 + 11 * 60 * 1000);
  const recentDate = new Date(today.getTime() - 2 * 3600 * 1000 + 5 * 60 * 1000);

  return [
    {
      id: 'demo-sentry-garage',
      category: 'sentry',
      folderName: '2026-11-25_18-42-15',
      startDate: sentryDate,
      totalDuration: 120,
      segments: makeDemoSegments(sentryDate, 2, 60),
      availableCameras: [...CORE_CAMERAS],
      eventJson: {
        timestamp: new Date(sentryDate.getTime() + 72 * 1000).toISOString(),
        city: '上海 · 陆家嘴国金中心 B2 车库',
        est_lat: '31.2363',
        est_lon: '121.5016',
        reason: 'sentry_aware_object_detection',
        camera: '3',
      },
      eventOffsetSeconds: 72,
      triggerCamera: 'left_repeater',
      locationLabel: '上海 · 陆家嘴国金中心 B2',
      reasonLabel: '哨兵 · 检测到靠近物体',
      isDemo: true,
      demoScene: 'sentry_garage',
    },
    {
      id: 'demo-saved-highway',
      category: 'saved',
      folderName: '2026-11-25_14-18-04',
      startDate: highwayDate,
      totalDuration: 90,
      segments: makeDemoSegments(highwayDate, 2, 45),
      availableCameras: [...CORE_CAMERAS],
      eventJson: {
        timestamp: new Date(highwayDate.getTime() + 52 * 1000).toISOString(),
        city: '上海 · 延安高架路西向',
        est_lat: '31.2241',
        est_lon: '121.4519',
        reason: 'user_interaction_honk',
        camera: '0',
      },
      eventOffsetSeconds: 52,
      triggerCamera: 'front',
      locationLabel: '上海 · 延安高架路',
      reasonLabel: '鸣笛自动保存 · 变道加塞',
      isDemo: true,
      demoScene: 'highway_cutin',
    },
    {
      id: 'demo-saved-night',
      category: 'saved',
      folderName: '2026-11-24_21-11-30',
      startDate: nightDate,
      totalDuration: 60,
      segments: makeDemoSegments(nightDate, 1, 60),
      availableCameras: [...CORE_CAMERAS],
      eventJson: {
        timestamp: new Date(nightDate.getTime() + 35 * 1000).toISOString(),
        city: '上海 · 世纪大道',
        est_lat: '31.2290',
        est_lon: '121.5220',
        reason: 'user_interaction_dashcam_icon_tapped',
        camera: '0',
      },
      eventOffsetSeconds: 35,
      triggerCamera: 'front',
      locationLabel: '上海 · 世纪大道夜景',
      reasonLabel: '手动点击保存',
      isDemo: true,
      demoScene: 'night_city',
    },
    {
      id: 'demo-recent-park',
      category: 'recent',
      folderName: 'RecentClips_22-05',
      startDate: recentDate,
      totalDuration: 60,
      segments: makeDemoSegments(recentDate, 1, 60),
      availableCameras: [...CORE_CAMERAS],
      locationLabel: '张江科学城 · 超级充电站',
      reasonLabel: '最近循环录制 · 4 路同步',
      isDemo: true,
      demoScene: 'recent_park',
    },
  ];
}
