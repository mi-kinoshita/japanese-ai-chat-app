// src/components/ChatStatus.tsx

import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface ChatStatusProps {
  isLoading: boolean;
  isSubscribed: boolean;
  dailyMessageCount: number;
  maxDailyMessages: number;
}

const ChatStatus: React.FC<ChatStatusProps> = ({
  isLoading,
  isSubscribed,
  dailyMessageCount,
  maxDailyMessages,
}) => {
  return (
    <View style={styles.statusContainer}>
      {isLoading && <ActivityIndicator size="small" color="#4a43a1" />}
      {isSubscribed ? (
        <Text style={styles.premiumStatusText}>
          LunaTalk PRO: Unlimited Chat!
        </Text>
      ) : (
        <Text style={styles.freeStatusText}>
          Free chats remaining:{" "}
          {Math.max(0, maxDailyMessages - dailyMessageCount)} /{" "}
          {maxDailyMessages}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#f2f2f7",
  },
  premiumStatusText: {
    fontSize: 14,
    color: "green",
    fontWeight: "bold",
    marginLeft: 5,
  },
  freeStatusText: {
    fontSize: 14,
    color: "#888",
    marginLeft: 5,
  },
});

export default ChatStatus;
