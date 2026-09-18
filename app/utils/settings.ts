import { getSettingsStateByUserId, setCategoryNotificationStateByUserId, setLinkPreviewStateByUserId, setOfflineNotificationStateByUserId, setOnlineNotificationStateByUserId, setStreamMetadataStateByUserId, setTitleNotificationStateByUserId } from "../database/db";


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

export async function toggleTitleNotificationStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.title_change_notification === 1) {
      await setTitleNotificationStateByUserId(user_id, 0);
      return 0;
    } else {
      await setTitleNotificationStateByUserId(user_id, 1);
      return 1;
    }
}

export async function toggleCategoryNotificationStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.category_change_notification === 1) {
      await setCategoryNotificationStateByUserId(user_id, 0);
      return 0;
    } else {
      await setCategoryNotificationStateByUserId(user_id, 1);
      return 1;
    }
}

export async function toggleStreamMetadataStateByUserId(
  user_id: number,
): Promise<number> {
    const settingsState = await getSettingsStateByUserId(user_id);
    if (settingsState?.stream_metadata === 1) {
      await setStreamMetadataStateByUserId(user_id, 0);
      return 0;
    } else {
      await setStreamMetadataStateByUserId(user_id, 1);
      return 1;
    }
}
