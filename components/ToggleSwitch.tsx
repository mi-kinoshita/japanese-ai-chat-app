import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";

interface ToggleSwitchProps {
  label?: string;
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inActiveColor?: string;
  thumbColor?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  value,
  onValueChange,
  disabled = false,
  activeColor = "#666666",
  inActiveColor = "#ccc",
  thumbColor = "#f2f2f7",
}) => {
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 26],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inActiveColor, activeColor],
  });

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.track, disabled && styles.disabledTrack]}
        disabled={disabled}
      >
        <Animated.View
          style={[
            styles.track,
            { backgroundColor },
            disabled && styles.disabledTrack,
          ]}
        >
          <Animated.View
            style={[
              styles.thumb,
              { transform: [{ translateX }] },
              { backgroundColor: thumbColor },
              disabled && styles.disabledThumb,
            ]}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28, // 最小高さを設定
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginRight: 10,
    flexShrink: 1,
  },
  track: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 2,
    position: "relative",
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    elevation: 2,
    position: "absolute",
  },
  disabledTrack: {
    opacity: 0.6,
  },
  disabledThumb: {
    opacity: 0.8,
  },
});

export default ToggleSwitch;
