import "react-native-get-random-values";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants"; // Constants for expoExtra
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases"; // RevenueCat
import { v4 as uuidv4 } from "uuid";

// コンポーネントのインポート
import ChatHeader from "../components/ChatHeader";
import ChatInput from "../components/ChatInput";
import ChatStatus from "../components/ChatStatus";
import MessageItem from "../components/MessageItem";

import { callGeminiAPI } from "../api/gemini";
import { BASE_LUNA_PROMPT_TEMPLATE } from "../constants/prompts";
import { scenarios } from "../constants/scenarios";
import { useProgressData } from "../hooks/useProgressData";
import { Message } from "../types/message";

// RevenueCatのENTITLEMENT_IDを定義
const expoExtra = Constants.expoConfig?.extra;
const ENTITLEMENT_ID = expoExtra?.EXPO_PUBLIC_ENTITLEMENT_ID;

const CONVERSATION_STORAGE_KEY_PREFIX = "chatConversation_";
const CONVERSATION_SUMMARIES_KEY = "_conversationSummaries_";
const USER_SETTINGS_KEY = "userSettings";
const SURVEY_ANSWERS_KEY = "surveyAnswers";

const DEVICE_ID_STORAGE_KEY = "appDeviceId";
const DAILY_REPORT_COUNT_PREFIX = "dailyReportsCount_";
const MAX_DAILY_REPORTS = 10;

const DAILY_MESSAGE_COUNT_PREFIX = "dailyMessagesCount_";
const MAX_DAILY_MESSAGES = 3; // 1日のメッセージ上限数 (非購読者向け)

const characterSettingOptions = ["English", "Romaji", "Katakana", "Kanji"];

interface ConversationSummary {
  id: string;
  participantName: string;
  lastMessage: string;
  timestamp: string;
  initialPrompt?: string | undefined;
  icon?: string;
  text?: string;
}

interface UserSettings {
  profileImageUri: string | null;
  username: string | null;
}

interface SurveyAnswers {
  q1?: string;
  q2?: string[];
  q3?: string;
  username?: string;
  [key: string]: any;
}

const ChatScreen = () => {
  // State and Refs
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { progress } = useProgressData();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("Chat");

  const params = useLocalSearchParams();
  const rawInitialPromptFromParams = params.initialPrompt;
  const initialPrompt: string | undefined =
    typeof rawInitialPromptFromParams === "string"
      ? rawInitialPromptFromParams
      : Array.isArray(rawInitialPromptFromParams) &&
        rawInitialPromptFromParams.length > 0
      ? rawInitialPromptFromParams[0]
      : undefined;

  const routeConversationId = params.conversationId as string | undefined;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [dailyReportCount, setDailyReportCount] = useState(0);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  // 新しいステート：SettingsScreenから読み込んだキャラクターレベル
  const [characterLevelFromSettings, setCharacterLevelFromSettings] = useState<
    string | null
  >(null);

  const currentReportDayRef = useRef<string | null>(null);
  const currentMessageDayRef = useRef<string | null>(null);

  // RevenueCat関連のState
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isRevenueCatConfigured, setIsRevenueCatConfigured] = useState(false);

  // Helper Functions
  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const getTodayDateString = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const getOrCreateDeviceId = useCallback(async () => {
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (!id) {
        id = uuidv4();
        await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      }
      setDeviceId(id);
      console.log("Device ID:", id);
    } catch (error) {
      console.error("Failed to get or create device ID:", error);
      setDeviceId(null);
    }
  }, [setDeviceId]);

  const saveDailyReportCount = useCallback(
    async (count: number) => {
      const today = currentReportDayRef.current || getTodayDateString();
      try {
        await AsyncStorage.setItem(
          `${DAILY_REPORT_COUNT_PREFIX}${today}`,
          count.toString()
        );
        console.log(`Saved daily report count for ${today}: ${count}`);
      } catch (error) {
        console.error("Failed to save daily report count:", error);
      }
    },
    [currentReportDayRef, getTodayDateString]
  );

  const saveDailyMessageCount = useCallback(
    async (count: number) => {
      const today = currentMessageDayRef.current || getTodayDateString();
      try {
        await AsyncStorage.setItem(
          `${DAILY_MESSAGE_COUNT_PREFIX}${today}`,
          count.toString()
        );
        console.log(`Saved daily message count for ${today}: ${count}`);
      } catch (error) {
        console.error("Failed to save daily message count:", error);
      }
    },
    [currentMessageDayRef, getTodayDateString]
  );

  const showPaymentPrompt = useCallback(() => {
    Alert.alert(
      "Daily Message Limit Reached",
      `You have sent ${MAX_DAILY_MESSAGES} messages today. Please subscribe to LunaTalk PRO for unlimited chat!`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Upgrade Now",
          style: "default",
          onPress: () => {
            router.push("/paymentScreen");
          },
        },
      ]
    );
  }, [router]);

  const getConversationSummary = useCallback(
    async (id: string): Promise<ConversationSummary | undefined> => {
      try {
        const storedSummaries = await AsyncStorage.getItem(
          CONVERSATION_SUMMARIES_KEY
        );
        const summaries: ConversationSummary[] = storedSummaries
          ? JSON.parse(storedSummaries)
          : [];
        return summaries.find((s) => s.id === id);
      } catch (error) {
        console.error(
          `Failed to get conversation summary for ID: ${id}`,
          error
        );
        return undefined;
      }
    },
    []
  );

  const loadMessages = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const storedConversation = await AsyncStorage.getItem(
          `${CONVERSATION_STORAGE_KEY_PREFIX}${id}`
        );
        if (storedConversation) {
          const parsedConversation = JSON.parse(
            storedConversation
          ) as Message[];
          setMessages(parsedConversation);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error(
          `Failed to load messages for conversation ID: ${id}`,
          error
        );
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, setMessages]
  );

  const saveMessages = useCallback(async (id: string, msgs: Message[]) => {
    try {
      const jsonValue = JSON.stringify(msgs);
      await AsyncStorage.setItem(
        `${CONVERSATION_STORAGE_KEY_PREFIX}${id}`,
        jsonValue
      );
    } catch (error) {
      console.error(
        `Failed to save messages for conversation ID: ${id}`,
        error
      );
    }
  }, []);

  const saveConversationSummary = useCallback(
    async (summary: ConversationSummary) => {
      try {
        const storedSummaries = await AsyncStorage.getItem(
          CONVERSATION_SUMMARIES_KEY
        );
        let summaries: ConversationSummary[] = storedSummaries
          ? JSON.parse(storedSummaries)
          : [];

        const existingIndex = summaries.findIndex((s) => s.id === summary.id);
        if (existingIndex > -1) {
          summaries[existingIndex] = summary;
        } else {
          summaries.unshift(summary); // 新しいサマリーをリストの先頭に追加
        }

        await AsyncStorage.setItem(
          CONVERSATION_SUMMARIES_KEY,
          JSON.stringify(summaries)
        );
      } catch (error) {
        console.error(
          `Failed to save conversation summary for ID: ${summary.id}`,
          error
        );
      }
    },
    []
  );

  // API Interaction Functions
  const fetchInitialMessage = useCallback(
    async (promptToSend: string, id: string) => {
      setIsLoading(true);
      try {
        const storedUserSettings = await AsyncStorage.getItem(
          USER_SETTINGS_KEY
        );
        let currentUsername: string | null = null;
        if (storedUserSettings) {
          const parsedSettings: UserSettings = JSON.parse(storedUserSettings);
          currentUsername = parsedSettings.username || null;
        }
        // characterLevelFromSettingsを直接使用
        const selectedLevel =
          characterLevelFromSettings || characterSettingOptions[0];

        let characterLevelInstruction = "";

        switch (selectedLevel) {
          case "English":
            characterLevelInstruction =
              "Output primarily in English. When introducing Japanese words or phrases, provide immediate English translations or explanations. The primary goal is comprehension in English, with gentle introduction to Japanese.";
            break;
          case "Romaji":
            characterLevelInstruction =
              "Output Japanese using ONLY romaji. Do not use hiragana, katakana, or kanji.";
            break;
          case "Katakana":
            characterLevelInstruction =
              "Output Japanese using hiragana, katakana, and romaji. DO NOT use kanji.";
            break;
          case "Kanji":
            characterLevelInstruction =
              "Output Japanese using kanji, hiragana, katakana, and romaji as appropriate for a native speaker.";
            break;
          default:
            characterLevelInstruction =
              "Output primarily in English. When introducing Japanese words or phrases, provide immediate English translations or explanations. The primary goal is comprehension in English, with gentle introduction to Japanese.";
            console.warn(
              "[DEBUG] Unexpected character level value:",
              selectedLevel,
              "Defaulting to English."
            );
        }

        let finalSystemInstruction = BASE_LUNA_PROMPT_TEMPLATE.replace(
          "{CHARACTER_LEVEL_INSTRUCTION_PLACEHOLDER}",
          characterLevelInstruction.trim()
        );

        if (currentUsername) {
          finalSystemInstruction = finalSystemInstruction.replace(
            characterLevelInstruction.trim(),
            currentUsername
              ? `The user's name is ${currentUsername}. ${characterLevelInstruction.trim()}`
              : characterLevelInstruction.trim()
          );
        }

        console.log("[DEBUG] Loaded Character Level:", selectedLevel);
        console.log(
          "[DEBUG] Constructed Character Level Instruction:",
          characterLevelInstruction
        );
        console.log(
          "[DEBUG] Final System Instruction sent to API (initial message):",
          finalSystemInstruction
        );

        const messagesForApi: Message[] = [];

        messagesForApi.push({
          sender: "user",
          text: finalSystemInstruction,
          timestamp: "",
        });
        messagesForApi.push({
          sender: "user",
          text: promptToSend,
          timestamp: "",
        });

        const responseText = await callGeminiAPI(messagesForApi);

        const timestamp = new Date().toISOString();

        const initialAiMessage: Message = {
          text: responseText,
          sender: "ai",
          timestamp,
        };

        const uiMessages: Message[] = [initialAiMessage];

        setMessages(uiMessages);

        if (id) {
          await saveMessages(id, uiMessages);
          const existingSummary = await getConversationSummary(id);
          if (existingSummary) {
            const updatedSummary: ConversationSummary = {
              ...existingSummary,
              lastMessage: initialAiMessage.text,
              timestamp: new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
            await saveConversationSummary(updatedSummary);
          } else {
            // 新規作成された会話のサマリーは既に保存済みなので、ここでは何もしない
          }
        }
      } catch (error) {
        console.error("Error fetching initial message:", error);
        const timestamp = new Date().toISOString();
        const errorMessage: Message = {
          text: `An error occurred: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          sender: "ai",
          timestamp,
          isError: true,
        };
        const uiMessagesWithError: Message[] = [errorMessage];
        setMessages(uiMessagesWithError);

        if (id) {
          await saveMessages(id, uiMessagesWithError);
          const existingSummary = await getConversationSummary(id);
          if (existingSummary) {
            const updatedSummary: ConversationSummary = {
              ...existingSummary,
              lastMessage: errorMessage.text,
              timestamp: new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
            await saveConversationSummary(updatedSummary);
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      setIsLoading,
      setMessages,
      saveMessages,
      getConversationSummary,
      saveConversationSummary,
      setChatTitle,
      setConversationId,
      characterLevelFromSettings, // 依存配列に追加
    ]
  );

  const handleReportMessage = useCallback(
    async (message: Message) => {
      if (!conversationId || !deviceId) {
        Alert.alert(
          "Error",
          "Cannot report message. Missing required information."
        );
        return;
      }

      if (dailyReportCount >= MAX_DAILY_REPORTS) {
        Alert.alert(
          "Daily Limit Reached",
          `You have reached the maximum of ${MAX_DAILY_REPORTS} reports per day. Please try again tomorrow.`
        );
        return;
      }

      Alert.prompt(
        "Report Message",
        "Please provide a reason for reporting this message:",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          // {
          //   text: "Report",
          //   onPress:
          //   async (reason) => {
          //     if (!reason || reason.trim() === "") {
          //       Alert.alert("Error", "Please enter a reason for the report.");
          //       return;
          //     }

          //     setIsLoading(true);
          //     try {
          //       const reportData = {
          //         device_id: deviceId,
          //         conversation_id: conversationId,
          //         message_text: message.text,
          //         message_timestamp: message.timestamp,
          //         reason: reason.trim(),
          //       };

          //       const successMessage = await reportInappropriateMessage(
          //         reportData
          //       );

          //       const newReportCount = dailyReportCount + 1;
          //       setDailyReportCount(newReportCount);
          //       await saveDailyReportCount(newReportCount);

          //       Alert.alert(
          //         "Success",
          //         `${successMessage}\nReports today: ${newReportCount}/${MAX_DAILY_REPORTS}`
          //       );
          //     } catch (error) {
          //       console.error("Report failed:", error);
          //       Alert.alert(
          //         "Report failed",
          //         `Failed to submit report: ${
          //           error instanceof Error ? error.message : "Unknown error"
          //         }`
          //       );
          //     } finally {
          //       setIsLoading(false);
          //     }
          //   },
          // },
        ],
        "plain-text"
      );
    },
    [
      conversationId,
      deviceId,
      dailyReportCount,
      saveDailyReportCount,
      setIsLoading,
      setDailyReportCount,
    ]
  );

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading || !conversationId) return;

    if (!isSubscribed && dailyMessageCount >= MAX_DAILY_MESSAGES) {
      showPaymentPrompt();
      return;
    }

    setIsLoading(true);
    const timestamp = new Date().toISOString();

    const userMessage: Message = {
      text: inputText,
      sender: "user",
      timestamp,
    };

    const messagesWithUserMessage = [...messages, userMessage];
    setMessages(messagesWithUserMessage);
    setInputText("");
    Keyboard.dismiss();

    if (!isSubscribed) {
      const newDailyMessageCount = dailyMessageCount + 1;
      setDailyMessageCount(newDailyMessageCount);
      await saveDailyMessageCount(newDailyMessageCount);
      console.log(
        `[DEBUG] Sent message. Daily count is now: ${newDailyMessageCount}/${MAX_DAILY_MESSAGES}`
      );
    } else {
      console.log("[DEBUG] User is subscribed, message count not incremented.");
    }

    try {
      const storedUserSettings = await AsyncStorage.getItem(USER_SETTINGS_KEY);
      let currentUsername: string | null = null;
      if (storedUserSettings) {
        const parsedSettings: UserSettings = JSON.parse(storedUserSettings);
        currentUsername = parsedSettings.username || null;
      }
      // characterLevelFromSettingsを直接使用
      const selectedLevel =
        characterLevelFromSettings || characterSettingOptions[0];

      let characterLevelInstruction = "";

      switch (selectedLevel) {
        case "English":
          characterLevelInstruction =
            "Output primarily in English. When introducing Japanese words or phrases, provide immediate English translations or explanations. The primary goal is comprehension in English, with gentle introduction to Japanese.";
          break;
        case "Romaji":
          characterLevelInstruction =
            "Output Japanese using ONLY romaji. Do not use hiragana, katakana, or kanji.";
          break;
        case "Katakana":
          characterLevelInstruction =
            "Output Japanese using hiragana, katakana, and romaji. DO NOT use kanji.";
          break;
        case "Kanji":
          characterLevelInstruction =
            "Output Japanese using kanji, hiragana, katakana, and romaji as appropriate for a native speaker.";
          break;
        default:
          characterLevelInstruction =
            "Output primarily in English. When introducing Japanese words or phrases, provide immediate English translations or explanations. The primary goal is comprehension in English, with gentle introduction to Japanese.";
          console.warn(
            "[DEBUG] Unexpected character level value:",
            selectedLevel,
            "Defaulting to English."
          );
      }

      let finalSystemInstruction = BASE_LUNA_PROMPT_TEMPLATE.replace(
        "{CHARACTER_LEVEL_INSTRUCTION_PLACEHOLDER}",
        characterLevelInstruction.trim()
      );

      if (currentUsername) {
        finalSystemInstruction = finalSystemInstruction.replace(
          characterLevelInstruction.trim(),
          currentUsername
            ? `The user's name is ${currentUsername}. ${characterLevelInstruction.trim()}`
            : characterLevelInstruction.trim()
        );
      }

      console.log("[DEBUG] Loaded Character Level:", selectedLevel);
      console.log(
        "[DEBUG] Constructed Character Level Instruction:",
        characterLevelInstruction
      );
      console.log(
        "[DEBUG] Final System Instruction sent to API (send message):",
        finalSystemInstruction
      );

      const messagesForApi: Message[] = [];
      messagesForApi.push({
        sender: "user",
        text: finalSystemInstruction,
        timestamp: "",
      });

      const summary = await getConversationSummary(conversationId);
      const initialUserInputForApi = summary?.initialPrompt || "Hello!";

      messagesForApi.push({
        sender: "user",
        text: initialUserInputForApi,
        timestamp: "",
      });

      messagesForApi.push(...messagesWithUserMessage);

      const responseText = await callGeminiAPI(messagesForApi);

      const aiTimestamp = new Date().toISOString();

      const aiMessage: Message = {
        text: responseText,
        sender: "ai",
        timestamp: aiTimestamp,
      };

      const finalMessages = [...messagesWithUserMessage, aiMessage];
      setMessages(finalMessages);

      if (conversationId) {
        await saveMessages(conversationId, finalMessages);
        const existingSummary = await getConversationSummary(conversationId);
        if (existingSummary) {
          const updatedSummary: ConversationSummary = {
            ...existingSummary,
            lastMessage: aiMessage.text,
            timestamp: new Date(aiTimestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          await saveConversationSummary(updatedSummary);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);

      const timestamp = new Date().toISOString();
      const errorMessage: Message = {
        text: `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        sender: "ai",
        timestamp,
        isError: true,
      };

      const messagesWithError = [...messagesWithUserMessage, errorMessage];
      setMessages(messagesWithError);

      if (conversationId) {
        await saveMessages(conversationId, messagesWithError);
        const existingSummary = await getConversationSummary(conversationId);
        if (existingSummary) {
          const updatedSummary: ConversationSummary = {
            ...existingSummary,
            lastMessage: errorMessage.text,
            timestamp: new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          await saveConversationSummary(updatedSummary);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    inputText,
    isLoading,
    messages,
    conversationId,
    setIsLoading,
    setMessages,
    saveMessages,
    getConversationSummary,
    saveConversationSummary,
    dailyMessageCount,
    saveDailyMessageCount,
    showPaymentPrompt,
    isSubscribed,
    characterLevelFromSettings, // 依存配列に追加
  ]);

  // Effects
  useEffect(() => {
    getOrCreateDeviceId();
  }, [getOrCreateDeviceId]);

  useEffect(() => {
    const today = getTodayDateString();
    currentReportDayRef.current = today;
    currentMessageDayRef.current = today;

    const loadDailyCountsAndSettings = async () => {
      // Renamed for clarity
      try {
        const storedReportCount = await AsyncStorage.getItem(
          `${DAILY_REPORT_COUNT_PREFIX}${today}`
        );
        if (storedReportCount !== null) {
          setDailyReportCount(parseInt(storedReportCount, 10));
        } else {
          setDailyReportCount(0);
        }

        const storedMessageCount = await AsyncStorage.getItem(
          `${DAILY_MESSAGE_COUNT_PREFIX}${today}`
        );
        if (storedMessageCount !== null) {
          setDailyMessageCount(parseInt(storedMessageCount, 10));
        } else {
          setDailyMessageCount(0);
        }

        // キャラクターレベルの設定を読み込む
        const storedSurveyAnswers = await AsyncStorage.getItem(
          SURVEY_ANSWERS_KEY
        );
        let surveyAnswers: { [key: string]: any } = {};
        if (storedSurveyAnswers !== null) {
          surveyAnswers = JSON.parse(storedSurveyAnswers);
        }
        // characterSettingOptions[0] をデフォルト値として設定
        setCharacterLevelFromSettings(
          surveyAnswers.q3 || characterSettingOptions[0]
        );
      } catch (error) {
        console.error("Failed to load daily counts and settings:", error);
        setDailyReportCount(0);
        setDailyMessageCount(0);
        setCharacterLevelFromSettings(characterSettingOptions[0]); // エラー時もデフォルトを設定
      }
    };

    loadDailyCountsAndSettings();
  }, [
    getTodayDateString,
    setDailyReportCount,
    setDailyMessageCount,
    setCharacterLevelFromSettings,
  ]);

  useEffect(() => {
    const configureRevenueCat = async () => {
      try {
        if (await Purchases.isConfigured()) {
          console.log("RevenueCat is already configured in ChatScreen.");
          setIsRevenueCatConfigured(true);
          return;
        }

        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        if (!expoExtra) {
          throw new Error(
            ".env variables are not loaded correctly. Ensure app.config.js is set up and .env exists."
          );
        }

        let apiKey: string;
        if (Platform.OS === "android") {
          if (!expoExtra.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY) {
            throw new Error("Android API key is not defined in .env");
          }
          apiKey = expoExtra.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
        } else if (Platform.OS === "ios") {
          if (!expoExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY) {
            throw new Error("iOS API key is not defined in .env");
          }
          apiKey = expoExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
        } else {
          throw new Error("Unsupported platform");
        }

        await Purchases.configure({ apiKey });
        console.log("RevenueCat configured successfully in ChatScreen.");
        setIsRevenueCatConfigured(true);
      } catch (error: any) {
        console.error("RevenueCat configuration error in ChatScreen:", error);
        Alert.alert(
          "Configuration Error",
          `Failed to configure RevenueCat in ChatScreen: ${error.message}`
        );
      }
    };

    configureRevenueCat();
  }, []);

  useEffect(() => {
    if (!isRevenueCatConfigured) return;

    const checkAndSetSubscriptionStatus = async () => {
      try {
        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
        if (ENTITLEMENT_ID) {
          const isActive =
            customerInfo.entitlements.all[ENTITLEMENT_ID]?.isActive === true;
          setIsSubscribed(isActive);
          console.log(`ChatScreen subscription status: ${isActive}`);
        } else {
          console.warn(
            "ENTITLEMENT_ID is not defined in ChatScreen, cannot check subscription status."
          );
          setIsSubscribed(false);
        }
      } catch (e) {
        console.error("Error fetching customer info in ChatScreen:", e);
        setIsSubscribed(false);
      }
    };

    const customerInfoUpdateListener = (customerInfo: CustomerInfo) => {
      if (ENTITLEMENT_ID) {
        const isActive =
          customerInfo.entitlements.all[ENTITLEMENT_ID]?.isActive === true;
        setIsSubscribed(isActive);
        console.log(
          `ChatScreen subscription status updated by listener: ${isActive}`
        );
      }
    };

    checkAndSetSubscriptionStatus();
    Purchases.addCustomerInfoUpdateListener(customerInfoUpdateListener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoUpdateListener);
      console.log("RevenueCat customer info listener removed from ChatScreen.");
    };
  }, [isRevenueCatConfigured]);

  useEffect(() => {
    const loadOrCreateConversation = async () => {
      try {
        let conversationInitialPrompt = initialPrompt || "Hello!";
        let currentId = routeConversationId;

        if (initialPrompt && !routeConversationId) {
          const newId = uuidv4();
          setConversationId(newId);
          currentId = newId;

          const selectedScenario = scenarios.find(
            (s) => s.prompt === initialPrompt
          );
          const participantName = selectedScenario?.text || "Language AI";
          setChatTitle(participantName);

          const newSummary: ConversationSummary = {
            id: newId,
            participantName: participantName,
            lastMessage: "New conversation started...",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            initialPrompt: initialPrompt,
            icon: selectedScenario?.icon,
            text: selectedScenario?.text,
          };
          await saveConversationSummary(newSummary);
          setMessages([]);
          fetchInitialMessage(conversationInitialPrompt, newId);
        } else if (routeConversationId) {
          setConversationId(routeConversationId);
          await loadMessages(routeConversationId);
          const summary = await getConversationSummary(routeConversationId);
          if (summary) {
            setChatTitle(summary.participantName);
            conversationInitialPrompt = summary.initialPrompt || "Hello!";
          }
        } else {
          const newId = uuidv4();
          setConversationId(newId);
          currentId = newId;

          const defaultScenario = scenarios[0];
          const participantName = defaultScenario?.text || "Language AI";
          setChatTitle(participantName);
          conversationInitialPrompt = defaultScenario?.prompt || "Hello!";

          const newSummary: ConversationSummary = {
            id: newId,
            participantName: participantName,
            lastMessage: "New conversation started...",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            initialPrompt: conversationInitialPrompt,
            icon: defaultScenario?.icon,
            text: defaultScenario?.text,
          };
          await saveConversationSummary(newSummary);
          setMessages([]);
          fetchInitialMessage(conversationInitialPrompt, newId);
        }
      } catch (error) {
        console.error("Failed to load or create conversation:", error);
        Alert.alert("Error", "Failed to load or start conversation.");
        setIsLoading(false);
      }
    };

    loadOrCreateConversation();
  }, [
    initialPrompt,
    routeConversationId,
    loadMessages,
    getConversationSummary,
    saveConversationSummary,
    fetchInitialMessage,
    setConversationId,
    setChatTitle,
    setMessages,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      <ChatHeader title={chatTitle} onBackPress={handleGoBack} />

      <ChatStatus
        isLoading={isLoading}
        isSubscribed={isSubscribed}
        dailyMessageCount={dailyMessageCount}
        maxDailyMessages={MAX_DAILY_MESSAGES}
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item, index }) => {
          if (!item) {
            console.warn(
              "FlatList renderItem: item is undefined at index:",
              index
            );
            return null;
          }
          return (
            <MessageItem
              item={item}
              isLoading={isLoading}
              onReportMessage={handleReportMessage}
            />
          );
        }}
        keyExtractor={(item, index) => {
          if (!item || !item.timestamp) {
            return `message-${index}`;
          }
          return `${item.timestamp}-${index}`;
        }}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <ChatInput
        inputText={inputText}
        onInputChange={setInputText}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  messageList: {
    backgroundColor: "#f9f9f9",
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});

export default ChatScreen;
