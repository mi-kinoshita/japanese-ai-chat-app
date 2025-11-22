import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  MakePurchaseResult,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

interface PackageItemProps {
  item: PurchasesPackage;
  isSelected: boolean;
  onPress: (item: PurchasesPackage) => void;
  isPopular?: boolean;
}

const PackageItem: React.FC<PackageItemProps> = ({
  item,
  isSelected,
  onPress,
  isPopular,
}) => (
  <TouchableOpacity
    style={[styles.packageItem, isSelected && styles.selectedPackageItem]}
    onPress={() => onPress(item)}
  >
    {isPopular && (
      <View style={styles.popularBadge}>
        <Text style={styles.popularBadgeText}>Popular</Text>
      </View>
    )}
    <Text style={styles.packageTitle}>
      {item.product.title || item.product.description}
    </Text>
    <Text style={styles.packagePrice}>{item.product.priceString}</Text>
    {item.product.description && (
      <Text style={styles.packageDescription}>{item.product.description}</Text>
    )}
  </TouchableOpacity>
);

const expoExtra = Constants.expoConfig?.extra;
const ENTITLEMENT_ID = expoExtra?.EXPO_PUBLIC_ENTITLEMENT_ID;

const PaymentScreen = () => {
  const navigation = useNavigation();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // RevenueCat configuration - separate from data fetching
  useEffect(() => {
    const configureRevenueCat = async () => {
      try {
        // Check if already configured
        if (await Purchases.isConfigured()) {
          console.log("RevenueCat is already configured");
          setIsConfigured(true);
          return;
        }

        // Set debug log level
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        // Validate environment variables
        if (!expoExtra) {
          throw new Error(
            ".env variables are not loaded correctly. Ensure app.config.js is set up and .env exists."
          );
        }

        let apiKey: string;
        if (Platform.OS === "android") {
          if (!expoExtra.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY) {
            throw new Error("Android API key is not defined in .env");
          }
          apiKey = expoExtra.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
        } else if (Platform.OS === "ios") {
          if (!expoExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY) {
            throw new Error("iOS API key is not defined in .env");
          }
          apiKey = expoExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
        } else {
          throw new Error("Unsupported platform");
        }

        // Configure RevenueCat
        await Purchases.configure({ apiKey });
        console.log("RevenueCat configured successfully");
        setIsConfigured(true);
      } catch (error: any) {
        console.error("RevenueCat configuration error:", error);
        setPurchaseError(`Failed to configure RevenueCat: ${error.message}`);
        Alert.alert(
          "Configuration Error",
          `Failed to configure RevenueCat: ${error.message}`
        );
        setLoading(false);
      }
    };

    configureRevenueCat();
  }, []);

  // Fetch data after RevenueCat is configured
  useEffect(() => {
    if (!isConfigured) return;

    const fetchPurchaseData = async () => {
      try {
        setLoading(true);
        setPurchaseError(null);

        // Get current customer info
        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();

        // Check subscription status
        if (ENTITLEMENT_ID) {
          const isActive =
            customerInfo.entitlements.all[ENTITLEMENT_ID]?.isActive === true;
          setIsSubscribed(isActive);
          console.log(`Subscription status: ${isActive}`);
        } else {
          console.warn(
            "ENTITLEMENT_ID is not defined, cannot check subscription status."
          );
          setIsSubscribed(false);
        }

        // Get available packages
        const offerings = await Purchases.getOfferings();
        if (
          offerings.current &&
          offerings.current.availablePackages.length > 0
        ) {
          const availablePackages = offerings.current.availablePackages;
          setPackages(availablePackages);
          console.log(`Found ${availablePackages.length} packages`);
        } else {
          setPurchaseError(
            "No available plans found. Please check your RevenueCat dashboard and App Store Connect/Google Play Console settings."
          );
        }

        // Set up customer info update listener
        const removeListener = Purchases.addCustomerInfoUpdateListener(
          (customerInfo: CustomerInfo) => {
            if (ENTITLEMENT_ID) {
              const isActive =
                customerInfo.entitlements.all[ENTITLEMENT_ID]?.isActive ===
                true;
              setIsSubscribed(isActive);
              console.log(`Subscription status updated: ${isActive}`);
            }
          }
        );

        // Store the remove function for cleanup
        return removeListener;
      } catch (error: any) {
        console.error("Error fetching purchase data:", error);
        setPurchaseError(`Failed to fetch purchase data: ${error.message}`);
        Alert.alert("Error", `Failed to fetch purchase data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseData();
  }, [isConfigured]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isSubscribed ? "Premium Activated" : "Upgrade to Premium",
      headerTitleStyle: {
        fontWeight: "bold",
        fontSize: 18,
      },
    });
  }, [navigation, isSubscribed]);

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert("Error", "Please select a plan.");
      return;
    }

    if (!isConfigured) {
      Alert.alert("Error", "RevenueCat is not configured.");
      return;
    }

    try {
      setPurchaseError(null);
      setLoading(true);

      console.log("Starting purchase for package:", selectedPackage.identifier);

      const purchaseResult: MakePurchaseResult =
        await Purchases.purchasePackage(selectedPackage);

      console.log("Purchase completed:", purchaseResult);

      // Check if the purchase resulted in an active entitlement
      if (
        ENTITLEMENT_ID &&
        purchaseResult?.customerInfo?.entitlements?.all[ENTITLEMENT_ID]
          ?.isActive
      ) {
        setIsSubscribed(true);
        Alert.alert(
          "Purchase Complete",
          "Your subscription purchase is complete. Thank you!",
          [
            {
              text: "OK",
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      } else {
        console.warn("Purchase did not result in active entitlement.");
        setPurchaseError(
          "Purchase completed but entitlement was not activated."
        );
      }
    } catch (error: any) {
      console.error("Purchase error:", error);

      if (error.userCancelled) {
        console.log("Purchase was cancelled by user");
        setPurchaseError("Purchase was cancelled.");
      } else if (error.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR) {
        console.error("Store problem during purchase:", error);
        setPurchaseError("Store problem occurred. Please try again later.");
      } else {
        setPurchaseError(error.message || "Error occurred during purchase.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchase = async () => {
    if (!isConfigured) {
      Alert.alert("Error", "RevenueCat is not configured.");
      return;
    }

    try {
      setLoading(true);
      setPurchaseError(null);

      console.log("Starting purchase restoration...");

      const restoredPurchases: CustomerInfo =
        await Purchases.restorePurchases();

      console.log("Restore completed:", restoredPurchases);

      if (
        ENTITLEMENT_ID &&
        restoredPurchases?.entitlements?.all[ENTITLEMENT_ID]?.isActive
      ) {
        setIsSubscribed(true);
        Alert.alert("Restore Successful", "Purchase history restored.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert("Restore Failed", "No restorable purchases found.");
      }
    } catch (error: any) {
      console.error("Error restoring purchases:", error);
      setPurchaseError(`Error occurred during restoration: ${error.message}`);
      Alert.alert(
        "Error",
        `Error occurred during restoration: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading && !isConfigured) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Configuring RevenueCat...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading purchase information...</Text>
      </View>
    );
  }

  // Already subscribed state
  if (isSubscribed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitleText}>Premium Activated</Text>
          </View>
          <View style={styles.headerRightPlaceholder}></View>
        </View>
        <View style={styles.subscribedContainer}>
          <Text style={styles.subscribedText}>You are already subscribed.</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.goBackButton}
          >
            <Text style={styles.goBackButtonText}>Return to App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Plan selection screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>LunaTalk PRO</Text>
        </View>
        <View style={styles.headerRightPlaceholder}></View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/images/4coma.png")}
              resizeMode="contain"
              style={styles.mainImage}
              defaultSource={require("../assets/images/4coma.png")}
            />
          </View>
          <View style={styles.section}>
            <View style={styles.infoContainer}>
              <Text style={styles.title}>Unlimited Chat Practice</Text>
            </View>
            <View style={styles.plansContainer}>
              {packages.length > 0 ? (
                packages.map((item) => (
                  <PackageItem
                    key={item.identifier}
                    item={item}
                    isSelected={selectedPackage?.identifier === item.identifier}
                    onPress={setSelectedPackage}
                    isPopular={item.packageType === "MONTHLY"}
                  />
                ))
              ) : (
                <Text style={styles.loadingText}>No available plans.</Text>
              )}
            </View>

            {purchaseError && <Text style={styles.error}>{purchaseError}</Text>}

            <TouchableOpacity
              style={[
                styles.continueButton,
                !selectedPackage || loading
                  ? styles.continueButtonDisabled
                  : null,
              ]}
              onPress={handlePurchase}
              disabled={!selectedPackage || loading}
            >
              <Text style={styles.continueText}>
                {loading ? "Processing..." : "Continue"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestorePurchase}
              disabled={loading}
            >
              <Text style={[styles.restoreText, loading && { color: "#ccc" }]}>
                Restore Purchases
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  headerRightPlaceholder: {
    width: 38,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  contentContainer: {
    flexDirection: "column",
  },
  imageContainer: {
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  mainImage: {
    width: "100%",
    height: 300,
    borderRadius: 0,
    alignSelf: "center",
  },
  section: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingVertical: 30,
    paddingHorizontal: 30,
    flex: 1,
  },
  infoContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  plansContainer: {
    width: "100%",
    flexDirection: "column",
    marginBottom: 20,
  },
  packageItem: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 25,
    backgroundColor: "white",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    position: "relative",
    width: "100%",
  },
  selectedPackageItem: {
    borderColor: "#FFD700",
    borderWidth: 2,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 10,
    backgroundColor: "#FFD700",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 15,
    elevation: 3,
    zIndex: 1,
  },
  popularBadgeText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 10,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "left",
    flex: 1,
  },
  packagePrice: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    alignSelf: "flex-end",
  },
  packageDescription: {
    fontSize: 14,
    color: "#888",
    marginTop: 5,
    textAlign: "left",
    width: "100%",
  },
  continueButton: {
    width: "100%",
    padding: 15,
    marginTop: 20,
    borderRadius: 25,
    backgroundColor: "#4a43a1",
    alignItems: "center",
    marginBottom: 10,
  },
  continueButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  continueText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  restoreText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    textDecorationLine: "underline",
  },
  error: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
    padding: 10,
    backgroundColor: "rgba(255, 0, 0, 0.05)",
    borderRadius: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    width: "100%",
  },
  subscribedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  subscribedText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  goBackButton: {
    backgroundColor: "#4a43a1",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  goBackButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PaymentScreen;
