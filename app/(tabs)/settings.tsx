import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Import components
import ToggleSwitch from "@/components/ToggleSwitch";
import Dropdown from "../../components/Dropdown";
import Header from "../../components/Header";
import InputField from "../../components/InputField";

// Constants
const USER_SETTINGS_KEY = "userSettings";
const SURVEY_ANSWERS_KEY = "surveyAnswers";
const NOTIFICATION_REMINDERS_ENABLED_KEY = "notificationRemindersEnabled";
const DAILY_REMINDER_NOTIFICATION_ID = "dailyJapaneseReminder";
const REMINDER_TIME = { hour: 20, minute: 0 };

interface UserSettings {
  profileImageUri: string | null;
  username: string | null;
}

const defaultUserSettings: UserSettings = {
  profileImageUri: null,
  username: null,
};

const characterSettingOptions = ["English", "Romaji", "Katakana", "Kanji"];

export default function SettingsScreen() {
  const router = useRouter();

  // State management
  const [userSettings, setUserSettings] =
    useState<UserSettings>(defaultUserSettings);
  const [savedAnswers, setSavedAnswers] = useState<{
    [key: string]: any;
  } | null>(null);
  const [areRemindersEnabled, setAreRemindersEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [storedSettings, storedSurveyAnswers, remindersEnabled] =
        await Promise.all([
          AsyncStorage.getItem(USER_SETTINGS_KEY),
          AsyncStorage.getItem(SURVEY_ANSWERS_KEY),
          AsyncStorage.getItem(NOTIFICATION_REMINDERS_ENABLED_KEY),
        ]);

      // Process user settings
      let initialUserSettings: UserSettings = defaultUserSettings;
      if (storedSettings) {
        const parsedSettings: UserSettings = JSON.parse(storedSettings);
        initialUserSettings = {
          profileImageUri: parsedSettings.profileImageUri || null,
          username: parsedSettings.username || null,
        };
      }

      // Process survey answers
      let surveyAnswers: { [key: string]: any } = {};
      if (storedSurveyAnswers) {
        surveyAnswers = JSON.parse(storedSurveyAnswers);
      } else {
        surveyAnswers = { q3: characterSettingOptions[0] };
      }
      setSavedAnswers(surveyAnswers);

      // Set final user settings
      setUserSettings({
        ...initialUserSettings,
        username:
          initialUserSettings.username || surveyAnswers.username || null,
      });

      // Set reminder state
      setAreRemindersEnabled(remindersEnabled === "true");
    } catch (error) {
      console.error("Failed to load settings:", error);
      Alert.alert("Error", "Failed to load settings.");
      setUserSettings(defaultUserSettings);
      setAreRemindersEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: keyof UserSettings, value: any) => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...userSettings, [key]: value };
      await AsyncStorage.setItem(
        USER_SETTINGS_KEY,
        JSON.stringify(updatedSettings)
      );
      setUserSettings(updatedSettings);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      Alert.alert("Error", `Failed to save ${key}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "This app allows you to select a photo from your photo library to register your profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImageUri = result.assets[0].uri;
        await saveSetting("profileImageUri", selectedImageUri);
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Error", "Failed to select image.");
    }
  };

  const handleUsernameChange = (text: string) => {
    setUserSettings((prev) => ({ ...prev, username: text }));
  };

  const handleUsernameSubmit = async () => {
    await saveSetting("username", userSettings.username);
  };

  const handleCharacterSettingSelect = async (setting: string) => {
    if (savedAnswers?.q3 === setting) return;

    setIsSaving(true);

    try {
      const storedSurveyAnswers = await AsyncStorage.getItem(
        SURVEY_ANSWERS_KEY
      );
      const currentSurveyAnswers = storedSurveyAnswers
        ? JSON.parse(storedSurveyAnswers)
        : {};
      const updatedSurveyAnswers = { ...currentSurveyAnswers, q3: setting };

      await AsyncStorage.setItem(
        SURVEY_ANSWERS_KEY,
        JSON.stringify(updatedSurveyAnswers)
      );
      setSavedAnswers(updatedSurveyAnswers);
    } catch (error) {
      console.error("Failed to save character setting:", error);
      Alert.alert("Error", "Failed to save character setting.");
    } finally {
      setIsSaving(false);
    }
  };

  const requestNotificationPermissions = async (): Promise<boolean> => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    if (existingStatus === "granted") {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  };

  const scheduleNotification = async () => {
    const notificationContent = {
      title: "Hi there",
      body: "Let's have fun chatting time today!",
      sound: "default" as any,
    };

    const trigger = {
      repeats: true,
      hour: REMINDER_TIME.hour,
      minute: REMINDER_TIME.minute,
      type: SchedulableTriggerInputTypes.CALENDAR,
    } as const;

    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: trigger,
      identifier: DAILY_REMINDER_NOTIFICATION_ID,
    });
  };

  const handleReminderToggle = async (newValue: boolean) => {
    setIsSaving(true);

    try {
      if (newValue) {
        // Enable reminders
        const permissionsGranted = await requestNotificationPermissions();

        if (!permissionsGranted) {
          Alert.alert(
            "Permission Required",
            "Please enable notifications in your device settings to receive reminders."
          );
          return;
        }

        await Notifications.cancelAllScheduledNotificationsAsync();
        await scheduleNotification();
        await AsyncStorage.setItem(NOTIFICATION_REMINDERS_ENABLED_KEY, "true");

        setAreRemindersEnabled(true);
        Alert.alert(
          "All Set!",
          `You'll get a friendly reminder at ${
            REMINDER_TIME.hour
          }:${REMINDER_TIME.minute.toString().padStart(2, "0")} daily.`
        );
      } else {
        // Disable reminders
        await Notifications.cancelScheduledNotificationAsync(
          DAILY_REMINDER_NOTIFICATION_ID
        );
        await AsyncStorage.setItem(NOTIFICATION_REMINDERS_ENABLED_KEY, "false");

        setAreRemindersEnabled(false);
        Alert.alert("Reminders Off", "Your daily reminders are now off.");
      }
    } catch (error) {
      console.error("Failed to toggle reminders:", error);
      Alert.alert("Error", "Failed to update reminder settings.");
      setAreRemindersEnabled(!newValue); // Revert state on error
    } finally {
      setIsSaving(false);
    }
  };

  const renderProfileSection = () => (
    <TouchableOpacity
      onPress={pickImage}
      style={styles.profileImageContainer}
      disabled={isSaving}
    >
      <Image
        source={
          userSettings.profileImageUri
            ? { uri: userSettings.profileImageUri }
            : require("../../assets/images/wakuwaku.png")
        }
        style={styles.profileImage}
      />
      <View style={styles.cameraIcon}>
        <Ionicons name="camera" size={24} color="white" />
      </View>
    </TouchableOpacity>
  );

  const renderUsernameSection = () => (
    <View style={styles.settingItem}>
      <View style={styles.settingLabelContainer}>
        <Ionicons
          name="person-outline"
          size={20}
          color="#202020"
          style={styles.settingIcon}
        />
        <Text style={styles.settingLabel}>Username</Text>
      </View>
      <InputField
        value={userSettings.username || ""}
        onChangeText={handleUsernameChange}
        onBlur={handleUsernameSubmit}
        placeholder="Enter your username"
        editable={!isSaving}
      />
    </View>
  );

  const renderLevelSection = () => (
    <View style={styles.settingItem}>
      <View style={styles.settingLabelContainer}>
        <Ionicons
          name="language-outline"
          size={20}
          color="#202020"
          style={styles.settingIcon}
        />
        <Text style={styles.settingLabel}>Chat Display Format</Text>
      </View>
      <Dropdown
        label=""
        selectedValue={savedAnswers?.q3 || null}
        options={characterSettingOptions}
        onSelect={handleCharacterSettingSelect}
        placeholder="Select Display Format"
        disabled={isSaving}
        isLoading={savedAnswers === null}
      />
    </View>
  );

  const renderReminderSection = () => (
    <View style={[styles.settingItem, styles.reminderSection]}>
      <View style={styles.reminderRowContainer}>
        <View style={styles.reminderTextColumn}>
          <View style={styles.settingLabelContainer}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#202020"
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>
              Reminders at {REMINDER_TIME.hour}:00
            </Text>
          </View>
        </View>
        <ToggleSwitch
          value={areRemindersEnabled}
          onValueChange={handleReminderToggle}
          disabled={isSaving}
          activeColor="#4a43a1"
          inActiveColor="#ccc"
        />
      </View>
    </View>
  );

  const renderPremiumSection = () => (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={() => router.push("/paymentScreen")}
        style={styles.premiumLinkItem}
      >
        <Ionicons
          name="diamond-outline"
          size={20}
          color="#4a43a1"
          style={styles.premiumLinkIcon}
        />
        <Text style={styles.premiumLinkText}>LunaTalk PRO</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLinksSection = () => (
    <>
      <View style={styles.section}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://docs.google.com/forms/d/e/1FAIpQLSdIiaBK_bxLC4ls5-nnp6CMLaz3-3dTNC62WohrQVHmdO9FMg/viewform?usp=dialog"
            )
          }
          style={styles.linkItem}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color="#202020"
            style={styles.linkIcon}
          />
          <Text style={styles.linkText}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL("https://www.youtube.com/@aituber_luna")
          }
          style={styles.linkItem}
        >
          <Ionicons
            name="logo-youtube"
            size={20}
            color="#202020"
            style={styles.linkIcon}
          />
          <Text style={styles.linkText}>YouTube</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://www.freeprivacypolicy.com/live/f90c33d9-5721-4d67-ad51-614a93f0127b"
            )
          }
          style={styles.linkItem}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color="#202020"
            style={styles.linkIcon}
          />
          <Text style={styles.linkText}>Terms and Conditions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://www.freeprivacypolicy.com/live/5d8f70fa-81bc-4467-8899-14ec37bc190d"
            )
          }
          style={styles.linkItem}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color="#202020"
            style={styles.linkIcon}
          />
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a43a1" />
        <Text style={styles.loadingText}>Loading Settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Header title="Settings" />

        <View style={styles.content}>
          {renderProfileSection()}
          {renderUsernameSection()}
          {renderLevelSection()}
          {renderReminderSection()}
          {renderPremiumSection()}
          {renderLinksSection()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#4a43a1",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  profileImageContainer: {
    marginBottom: 20,
    alignItems: "center",
    position: "relative",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f0f0",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#4a43a1",
    borderRadius: 20,
    padding: 5,
  },
  settingItem: {
    width: "100%",
    marginBottom: 20,
  },
  settingLabelContainer: {
    // New style for icon and label
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  settingIcon: {
    // New style for the icon
    marginRight: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: "#202020",
  },
  reminderSection: {
    paddingBottom: 2,
  },
  reminderRowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  reminderTextColumn: {
    flexDirection: "column",
    flexShrink: 1,
    marginRight: 10,
  },
  section: {
    width: "100%",
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#202020",
    marginBottom: 10,
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  linkIcon: {
    marginRight: 10,
  },
  linkText: {
    fontSize: 16,
    color: "#373737",
  },
  premiumLinkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  premiumLinkIcon: {
    marginRight: 10,
  },
  premiumLinkText: {
    fontSize: 16,
    color: "#4a43a1",
  },
});
