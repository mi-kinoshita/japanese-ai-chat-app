import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DropdownProps {
  label?: string;
  selectedValue: string | null;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  containerStyle?: ViewStyle;
  headerStyle?: ViewStyle;
  optionStyle?: ViewStyle;
  textStyle?: TextStyle;
  selectedTextStyle?: TextStyle;
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  selectedValue,
  options,
  onSelect,
  placeholder = "Select an option",
  disabled = false,
  isLoading = false,
  containerStyle,
  headerStyle,
  optionStyle,
  textStyle,
  selectedTextStyle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
    }
  };

  const renderHeader = () => (
    <TouchableOpacity
      style={[
        styles.dropdownHeader,
        headerStyle,
        disabled && styles.disabledHeader,
      ]}
      onPress={toggleDropdown}
      disabled={disabled || isLoading}
    >
      <Text style={[styles.dropdownHeaderText, textStyle]}>
        {selectedValue || placeholder}
      </Text>
      {isLoading ? (
        <ActivityIndicator size="small" color="#666" />
      ) : (
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color={disabled ? "#999" : "#333"}
        />
      )}
    </TouchableOpacity>
  );

  const renderOptions = () => {
    if (!isOpen) return null;

    return (
      <View style={styles.dropdownOptionsContainer}>
        {options.map((option, index) => {
          const isSelected = selectedValue === option;
          return (
            <TouchableOpacity
              key={`${option}-${index}`}
              style={[
                styles.dropdownOptionItem,
                optionStyle,
                isSelected && styles.dropdownOptionItemSelected,
                index === options.length - 1 && styles.lastOptionItem,
              ]}
              onPress={() => handleSelect(option)}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  textStyle,
                  isSelected && styles.dropdownOptionTextSelected,
                  isSelected && selectedTextStyle,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.dropdownContainer}>
        {renderHeader()}
        {renderOptions()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#202020",
    marginBottom: 8,
  },
  dropdownContainer: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    elevation: 2,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    minHeight: 48,
  },
  disabledHeader: {
    backgroundColor: "#f5f5f5",
    opacity: 0.6,
  },
  dropdownHeaderText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownOptionsContainer: {
    borderTopWidth: 1,
    borderTopColor: "#666",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownOptionItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  dropdownOptionItemSelected: {
    backgroundColor: "#f2f2f7",
  },
  dropdownOptionText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownOptionTextSelected: {
    fontWeight: "600",
  },
});

export default Dropdown;
