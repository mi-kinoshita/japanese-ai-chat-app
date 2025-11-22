import React from "react";
import { TextInput, StyleSheet, TextInputProps } from "react-native";

interface InputFieldProps extends TextInputProps {
  // TextInputPropsを継承することで、TextInputの全ての標準プロパティを受け入れられるようにする
  // 必要に応じて、追加のカスタムプロパティをここに追加できます
}

const InputField: React.FC<InputFieldProps> = (props) => {
  return (
    <TextInput
      style={styles.inputField}
      placeholderTextColor="#ccc"
      {...props} // TextInputPropsを全て渡す
    />
  );
};

const styles = StyleSheet.create({
  inputField: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 10,
    paddingVertical: 12,
  },
});

export default InputField;
