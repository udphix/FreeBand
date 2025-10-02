import React, { useState, useEffect } from "react";
import {
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Platform,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";

export default function App() {

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64String, setBase64String] = useState<string>("");


  const [inputBase64, setInputBase64] = useState<string>("");


  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await MediaLibrary.requestPermissionsAsync();
      }
    })();
  }, []);


  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: false,
      quality: 1,
    });

    if (!result.canceled) {
      const img = result.assets[0].uri;


      const manipulated = await ImageManipulator.manipulateAsync(
        img,
        [{ resize: { width: 800 } }], 
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (manipulated.base64) {
        setImageUri(manipulated.uri);
        setBase64String(`data:image/jpeg;base64,${manipulated.base64}`);
      }
    }
  };


  const saveImageToGallery = async () => {
    if (!inputBase64.startsWith("data:image")) {
      Alert.alert("Error", "Base64 inválido");
      return;
    }

    try {
   
      const base64Data = inputBase64.replace(/^data:image\/\w+;base64,/, "");

      const { uri } = await ImageManipulator.manipulateAsync(
        inputBase64,
        [],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      const asset = await MediaLibrary.createAssetAsync(uri);
      Alert.alert("Guardado", "Imagen guardada en la galería");
    } catch (err) {
      console.error("Error guardando:", err);
      Alert.alert("Error", "No se pudo guardar la imagen");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Base64 Converter</Text>

    
      <View style={styles.block}>
        <Button title="Seleccionar Imagen" onPress={pickImage} />
        {imageUri && (
          <>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <Text style={styles.text}>
              Base64 generado (primeros 100 chars):
            </Text>
            <Text style={styles.base64}>{base64String.slice(0, 100)}...</Text>
          </>
        )}
      </View>

    
      <View style={styles.block}>
        <Text style={styles.text}>Pegar Base64:</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="data:image/jpeg;base64,..."
          value={inputBase64}
          onChangeText={setInputBase64}
        />
        {inputBase64.startsWith("data:image") && (
          <Image
            source={{ uri: inputBase64 }}
            style={styles.preview}
            resizeMode="contain"
          />
        )}
        <Button title="Guardar en Galería" onPress={saveImageToGallery} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    alignSelf: "center",
  },
  block: {
    marginBottom: 30,
  },
  preview: {
    width: "100%",
    height: 200,
    marginVertical: 12,
    backgroundColor: "#f3f3f3",
  },
  text: {
    marginVertical: 6,
    fontWeight: "600",
  },
  base64: {
    fontSize: 10,
    color: "#444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    minHeight: 80,
    padding: 8,
    textAlignVertical: "top",
  },
});