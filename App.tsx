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
  Switch,
  FlatList,
  TouchableOpacity,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Clipboard from "expo-clipboard";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const chunkString = (str: string, size: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
};

interface Stats {
  width: number;
  height: number;
  size: number;
}

export default function App() {
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64String, setBase64String] = useState<string>("");
  const [chunks, setChunks] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [originalStats, setOriginalStats] = useState<Stats | null>(null);
  const [compress, setCompress] = useState(true);
  const [quality, setQuality] = useState(0.7);
  const [maxSize, setMaxSize] = useState(512);
  const [chunkSize, setChunkSize] = useState(20000);
  const [inputBase64, setInputBase64] = useState("");

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await MediaLibrary.requestPermissionsAsync();
      }
    })();
  }, []);

  useEffect(() => {
    if (originalImageUri) {
      processImage(originalImageUri);
    }
  }, [compress, quality, maxSize, chunkSize]);

  const processImage = async (imgUri: string) => {
    const orig = await ImageManipulator.manipulateAsync(imgUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (orig.base64) {
      const b64orig = `data:image/jpeg;base64,${orig.base64}`;
      const origSize = Math.round(b64orig.length * 0.75);
      setOriginalStats({
        width: orig.width,
        height: orig.height,
        size: origSize,
      });

      if (!compress) {
        setImageUri(orig.uri);
        setBase64String(b64orig);
        setChunks(chunkString(b64orig, chunkSize));
        setStats({
          width: orig.width,
          height: orig.height,
          size: origSize,
        });
        return;
      }

      const maxSide = Math.max(orig.width, orig.height);
      let targetW = orig.width;
      let targetH = orig.height;

      if (maxSide > maxSize) {
        const scale = maxSize / maxSide;
        targetW = Math.round(orig.width * scale);
        targetH = Math.round(orig.height * scale);
      }

      const compressed = await ImageManipulator.manipulateAsync(
        imgUri,
        [{ resize: { width: targetW, height: targetH } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (compressed.base64) {
        const b64 = `data:image/jpeg;base64,${compressed.base64}`;
        const compSize = Math.round(b64.length * 0.75);

        setImageUri(compressed.uri);
        setBase64String(b64);
        setChunks(chunkString(b64, chunkSize));
        setStats({
          width: compressed.width,
          height: compressed.height,
          size: compSize,
        });
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: false,
      quality: 1,
    });

    if (!result.canceled) {
      const img = result.assets[0].uri;
      setOriginalImageUri(img);
      await processImage(img);
    }
  };

  const saveImageToGallery = async () => {
    if (!inputBase64.startsWith("data:image")) {
      Alert.alert("Error", "Invalid Base64 format");
      return;
    }

    try {
      const { uri } = await ImageManipulator.manipulateAsync(inputBase64, [], {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      await MediaLibrary.createAssetAsync(uri);
      Alert.alert("Success", "Image saved to gallery");
    } catch (err) {
      console.error("Error saving:", err);
      Alert.alert("Error", "Could not save image");
    }
  };

  const copyChunk = async (chunk: string, index: number) => {
    await Clipboard.setStringAsync(chunk);
    Alert.alert("Copied", `Fragment ${index + 1} copied to clipboard`);
  };

  const copyAll = async () => {
    await Clipboard.setStringAsync(base64String);
    Alert.alert("Success", "Complete Base64 copied to clipboard");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Base64 Converter</Text>

          {/* Compression Toggle */}
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.label}>Compression</Text>
              <Switch
                value={compress}
                onValueChange={(v) => setCompress(v)}
                trackColor={{ false: "#E5E5E5", true: "#000000" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Compression Settings */}
            {compress && (
              <View style={styles.settingsPanel}>
                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>
                    Quality: {Math.round(quality * 100)}%
                  </Text>
                  <View style={styles.buttonGroup}>
                    {[0.3, 0.5, 0.7, 0.9].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.optionButton,
                          quality === val && styles.optionButtonActive,
                        ]}
                        onPress={() => setQuality(val)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            quality === val && styles.optionTextActive,
                          ]}
                        >
                          {Math.round(val * 100)}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>Max Size: {maxSize}px</Text>
                  <View style={styles.buttonGroup}>
                    {[128, 256, 512, 1024].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.optionButton,
                          maxSize === val && styles.optionButtonActive,
                        ]}
                        onPress={() => setMaxSize(val)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            maxSize === val && styles.optionTextActive,
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>
                    Chunk Size: {(chunkSize / 1000).toFixed(0)}k
                  </Text>
                  <View style={styles.buttonGroup}>
                    {[10000, 20000, 30000, 50000].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.optionButton,
                          chunkSize === val && styles.optionButtonActive,
                        ]}
                        onPress={() => setChunkSize(val)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            chunkSize === val && styles.optionTextActive,
                          ]}
                        >
                          {val / 1000}k
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Encode Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Encode</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={pickImage}>
              <Text style={styles.primaryButtonText}>Select Image</Text>
            </TouchableOpacity>

            {imageUri && (
              <>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.preview}
                  resizeMode="contain"
                />

                {stats && (
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Dimensions</Text>
                      <Text style={styles.statValue}>
                        {stats.width} × {stats.height}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Size</Text>
                      <Text style={styles.statValue}>
                        {formatBytes(stats.size)}
                      </Text>
                    </View>
                    {originalStats && compress && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Reduced</Text>
                        <Text style={styles.statValue}>
                          {Math.round(
                            (1 - stats.size / originalStats.size) * 100
                          )}
                          %
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {chunks.length > 0 && (
                  <View style={styles.chunksSection}>
                    <View style={styles.chunksHeader}>
                      <Text style={styles.chunksTitle}>
                        Fragments: {chunks.length}
                      </Text>
                      <Text style={styles.chunksSubtitle}>
                        {base64String.length.toLocaleString()} characters
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={copyAll}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Copy Complete Base64
                      </Text>
                    </TouchableOpacity>

                    <FlatList
                      data={chunks}
                      keyExtractor={(_, idx) => String(idx)}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          style={styles.chunkItem}
                          onPress={() => copyChunk(item, index)}
                        >
                          <Text style={styles.chunkNumber}>
                            Fragment {index + 1}
                          </Text>
                          <Text style={styles.chunkSize}>
                            {Math.round(item.length / 1000)}k chars
                          </Text>
                        </TouchableOpacity>
                      )}
                      scrollEnabled={false}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          {/* Decode Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Decode</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Paste Base64 string here..."
              placeholderTextColor="#999"
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
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={saveImageToGallery}
            >
              <Text style={styles.secondaryButtonText}>Save to Gallery</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    color: "#000",
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#000",
    letterSpacing: -0.3,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  settingsPanel: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: "#666",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: "#000000",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#000000",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  preview: {
    width: "100%",
    height: 200,
    marginVertical: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  chunksSection: {
    marginTop: 8,
  },
  chunksHeader: {
    marginBottom: 12,
  },
  chunksTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  chunksSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  chunkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginTop: 8,
  },
  chunkNumber: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  chunkSize: {
    fontSize: 14,
    color: "#999",
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#000",
    textAlignVertical: "top",
    backgroundColor: "#FAFAFA",
  },
});
