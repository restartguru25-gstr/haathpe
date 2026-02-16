const KEY = "vendorhub_notification_settings";

export interface NotificationSettings {
  orderUpdates: boolean;
  promotions: boolean;
  drawResults: boolean;
}

const defaults: NotificationSettings = {
  orderUpdates: true,
  promotions: true,
  drawResults: true,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
      return { ...defaults, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...defaults };
}

export function setNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
