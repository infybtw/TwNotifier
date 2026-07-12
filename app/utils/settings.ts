import { getSettingsStateByUserId, setLinkPreviewStateByUserId, setOfflineNotificationStateByUserId, setOnlineNotificationStateByUserId } from "../database/db";


export async function toggleOnlineNotificationStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.online_notification === 1) {
      await setOnlineNotificationStateByUserId(user_id, 0);
      return 0;
    } else {
      await setOnlineNotificationStateByUserId(user_id, 1);
      return 1;
    }
}

export async function toggleOfflineNotificationStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.offline_notification === 1) {
      await setOfflineNotificationStateByUserId(user_id, 0);
      return 0;
    } else {
      await setOfflineNotificationStateByUserId(user_id, 1);
      return 1;
    }
}

export async function toggleLinkPreviewStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.link_preview === 1) {
      await setLinkPreviewStateByUserId(user_id, 0);
      return 0;
    } else {
      await setLinkPreviewStateByUserId(user_id, 1);
      return 1;
    }
}
