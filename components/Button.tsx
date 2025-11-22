import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  buttonStyle?: ViewStyle; // カスタムボタンのスタイル
  textStyle?: TextStyle; // カスタムテキストのスタイル
}

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  disabled = false,
  buttonStyle,
  textStyle,
}) => (
  <TouchableOpacity
    style={[styles.button, buttonStyle, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.buttonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#4a43a1", // デフォルトの背景色
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
    width: "90%", // デフォルトで幅いっぱいに広がるように
  },
  buttonText: {
    color: "#fff", // デフォルトの文字色
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#cccccc", // 無効時の背景色
  },
});

export default CustomButton;
