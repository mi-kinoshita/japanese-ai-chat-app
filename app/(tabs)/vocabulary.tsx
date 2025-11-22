import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
  Keyboard,
  ActivityIndicator,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import Header from "../../components/Header"; // Headerコンポーネントをインポート
import GenericButton from "../../components/GenericButton"; // GenericButtonコンポーネントをインポート
import InputField from "../../components/InputField"; // InputFieldコンポーネントをインポート

const VOCABULARY_STORAGE_KEY = "userVocabulary";

interface VocabularyEntry {
  id: string;
  word: string;
  meaning: string;
}

export default function VocabularyScreen() {
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVocabulary();
  }, []);

  const loadVocabulary = async () => {
    try {
      const storedVocabulary = await AsyncStorage.getItem(
        VOCABULARY_STORAGE_KEY
      );
      if (storedVocabulary) {
        setVocabulary(JSON.parse(storedVocabulary));
      }
    } catch (error) {
      console.error("Failed to load vocabulary:", error);
      Alert.alert("Error", "Failed to load vocabulary.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveVocabulary = async (vocab: VocabularyEntry[]) => {
    try {
      await AsyncStorage.setItem(VOCABULARY_STORAGE_KEY, JSON.stringify(vocab));
    } catch (error) {
      console.error("Failed to save vocabulary:", error);
      Alert.alert("Error", "Failed to save vocabulary.");
    }
  };

  const addWord = () => {
    if (newWord.trim() && newMeaning.trim()) {
      const newEntry: VocabularyEntry = {
        id: Date.now().toString(),
        word: newWord.trim(),
        meaning: newMeaning.trim(),
      };
      const updatedVocabulary = [...vocabulary, newEntry];
      setVocabulary(updatedVocabulary);
      saveVocabulary(updatedVocabulary);
      setNewWord("");
      setNewMeaning("");
      Keyboard.dismiss();
    } else {
      Alert.alert("Input Error", "Please enter both word and meaning.");
    }
  };

  const deleteWord = useCallback(
    async (id: string) => {
      const updatedVocabulary = vocabulary.filter((item) => item.id !== id);
      setVocabulary(updatedVocabulary);
      await saveVocabulary(updatedVocabulary);
    },
    [vocabulary, saveVocabulary]
  );

  const renderRightActions = (item: VocabularyEntry) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteWord(item.id)}
      >
        <Ionicons name="trash-outline" size={25} color="white" />
      </TouchableOpacity>
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: VocabularyEntry }) => (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        friction={2}
        rightThreshold={40}
        containerStyle={styles.swipeableItemContainer} // Swipeableコンテナにスタイルを適用
      >
        <View style={styles.vocabularyItem}>
          <Text style={styles.vocabularyWordText}>{item.word}</Text>
          {item.meaning ? (
            <Text style={styles.vocabularyMeaningText}>{item.meaning}</Text>
          ) : null}
        </View>
      </Swipeable>
    ),
    [renderRightActions]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a43a1" />
        <Text>Loading vocabulary...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Headerコンポーネントを使用 */}
      <Header title="My Vocabulary" />
      <View style={styles.inputContainer}>
        <View style={styles.inputsWrapper}>
          {/* InputField コンポーネントを使用 */}
          <InputField
            placeholder="Word"
            value={newWord}
            onChangeText={setNewWord}
            onSubmitEditing={() => {}}
          />
          <InputField
            placeholder="Meaning"
            value={newMeaning}
            onChangeText={setNewMeaning}
            onSubmitEditing={addWord}
          />
        </View>
        {/* GenericButton コンポーネントを使用 */}
        <GenericButton
          title="Add"
          onPress={addWord}
          disabled={!newWord.trim() || !newMeaning.trim()} // 入力がない場合は無効化
        />
      </View>
      <FlatList
        data={vocabulary}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
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
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "column",
    paddingTop: 15,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputsWrapper: {
    flexDirection: "column",
  },
  // inputField: {
  //   borderWidth: 1,
  //   borderColor: "#ccc",
  //   borderRadius: 5,
  //   paddingHorizontal: 10,
  //   fontSize: 16,
  //   marginBottom: 10,
  //   paddingVertical: 8,
  // },
  // addButtonとaddButtonTextスタイルはGenericButtonコンポーネント内で定義されるため、ここからは削除
  // addButton: {
  //   backgroundColor: "#4a43a1",
  //   paddingVertical: 10,
  //   borderRadius: 5,
  //   justifyContent: "center",
  //   alignItems: "center",
  //   marginVertical: 2,
  //   width: "100%",
  // },
  // addButtonText: {
  //   color: "#fff",
  //   fontSize: 16,
  //   fontWeight: "bold",
  // },
  list: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  // Swipeableコンテナにマージンを移動
  swipeableItemContainer: {
    marginBottom: 10,
  },
  // vocabularyItemからmarginBottomを削除
  vocabularyItem: {
    backgroundColor: "#f2f2f7",
    padding: 15,
    borderRadius: 5,
    // marginBottom: 10, // ここを削除
  },
  vocabularyWordText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  vocabularyMeaningText: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  // スワイプ削除ボタンのスタイル
  deleteButton: {
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%", // 高さは100%を維持
    borderRadius: 5,
    // marginVertical: 5, // ここは引き続き削除されたまま
    // alignSelf: "center", // ここも引き続き削除されたまま
  },
});
