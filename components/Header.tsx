import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants"; // Constants for statusBarHeight

interface HeaderProps {
  title: string;
  leftIconName?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  rightIconName?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  leftIconColor?: string;
  rightIconColor?: string;
  titleColor?: string;
  backgroundColor?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  leftIconName,
  onLeftPress,
  rightIconName,
  onRightPress,
  leftIconColor = "#4a43a1", // Default color
  rightIconColor = "#4a43a1", // Default color
  titleColor = "#000", // Default color
  backgroundColor = "#fff", // Default color
}) => {
  return (
    <View style={[styles.header, { backgroundColor: backgroundColor }]}>
      <TouchableOpacity
        style={styles.iconContainer}
        onPress={onLeftPress}
        disabled={!onLeftPress}
      >
        {leftIconName ? (
          <Ionicons name={leftIconName} size={28} color={leftIconColor} />
        ) : (
          <View style={styles.placeholder} /> // Placeholder for alignment
        )}
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: titleColor }]}>{title}</Text>
      </View>
      <TouchableOpacity
        style={styles.iconContainer}
        onPress={onRightPress}
        disabled={!onRightPress}
      >
        {rightIconName ? (
          <Ionicons name={rightIconName} size={28} color={rightIconColor} />
        ) : (
          <View style={styles.placeholder} /> // Placeholder for alignment
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === "android" ? Constants.statusBarHeight : 0,
  },
  iconContainer: {
    padding: 5,
    width: 38, // Ensure consistent width for icons/placeholders
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 28, // Match icon size
    height: 28, // Match icon size
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default Header;
