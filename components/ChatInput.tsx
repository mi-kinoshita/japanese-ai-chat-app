// src/components/ChatInput.tsx

import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import Octicons from "@expo/vector-icons/Octicons";

interface ChatInputProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onSendMessage: () => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  onInputChange,
  onSendMessage,
  isLoading,
}) => {
  // テキストが入力されているかどうかを判断
  const hasText = inputText.trim().length > 0;

  // 送信ボタンの背景色を動的に設定
  const sendButtonBackgroundColor = isLoading || !hasText ? "#fff" : "#fff"; // ロード中またはテキストがない場合は薄い色、それ以外は濃い色
  // 送信アイコンの色を動的に設定
  const sendIconColor = isLoading || !hasText ? "#d9d9de" : "#4a43a1"; // ロード中またはテキストがない場合は薄い色、それ以外は白

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      style={styles.inputContainer}
    >
      <TextInput
        style={styles.textInput}
        value={inputText}
        onChangeText={onInputChange}
        placeholder="Type your message..."
        placeholderTextColor="#999"
        multiline
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: sendButtonBackgroundColor },
        ]} // 背景色を適用
        onPress={onSendMessage}
        disabled={isLoading || !hasText} // ロード中またはテキストがない場合は無効
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Octicons name="paper-airplane" size={24} color={sendIconColor} />
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderRadius: 10, // Rounded corners for the text input
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 10,
    fontSize: 16,
    color: "#333",
  },
  sendButton: {
    borderRadius: 25, // Make it circular
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    // backgroundColorは動的に設定されるため、ここでは削除またはデフォルト値を設定
  },
});

export default ChatInput;
