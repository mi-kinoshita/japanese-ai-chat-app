import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Message } from "../types/message";

interface MessageItemProps {
  item: Message;
  isLoading: boolean;
  onReportMessage: (message: Message) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  item,
  isLoading,
  onReportMessage,
}) => {
  const isUser = item.sender === "user";
  const isAi = item.sender === "ai";

  if (item.text.startsWith("You are Luna.")) {
    return null;
  }

  const handleShareMessage = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }

      const textToShare = item.text.replace(/\n/g, " "); // Remove newlines for sharing

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `chat_message_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, textToShare, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        dialogTitle: "Share Message",
        UTI: "public.plain-text",
      });

      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error("Sharing error:", error);
      Alert.alert("Error", "Failed to share message.");
    }
  };

  const handleLongPress = () => {
    handleShareMessage();
  };

  const displayText = isAi ? item.text.replace(/\n/g, " ") : item.text;

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {isAi && (
        <Image
          source={require("../assets/images/80sgirl.jpeg")}
          style={styles.avatar}
        />
      )}

      <TouchableWithoutFeedback
        onLongPress={handleLongPress}
        delayLongPress={500}
        disabled={isLoading}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userMessageBubble : styles.aiMessageBubble,
            item.isError ? styles.errorMessageBubble : null,
          ]}
        >
          <Text
            style={[
              isUser ? styles.userMessageText : styles.aiMessageText,
              item.isError ? styles.errorMessageText : null,
            ]}
          >
            {displayText}
          </Text>
        </View>
      </TouchableWithoutFeedback>

      {isAi && (
        <TouchableOpacity
          onPress={() => onReportMessage(item)}
          disabled={isLoading}
          style={styles.reportButton}
        >
          <Ionicons
            name="flag-outline"
            size={12}
            color={isLoading ? "#d9d9de" : "#97979b"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    maxWidth: "85%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  aiMessageContainer: {
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    borderColor: "#ccc",
    borderWidth: 0.5,
  },
  messageBubble: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    maxWidth: "85%",
    elevation: 2,
    flexShrink: 1,
  },
  userMessageBubble: {
    backgroundColor: "#4a43a1",
    borderBottomRightRadius: 5,
    marginLeft: "auto",
  },
  aiMessageBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 5,
    marginRight: 0,
  },
  errorMessageBubble: {
    backgroundColor: "#ffcccc",
  },
  userMessageText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  aiMessageText: {
    color: "#333",
    fontSize: 16,
    lineHeight: 22,
  },
  errorMessageText: {
    color: "#cc0000",
  },
  reportButton: {
    marginLeft: 8,
    alignSelf: "flex-end",
    padding: 8,
    opacity: 0.7,
  },
});

export default MessageItem;
