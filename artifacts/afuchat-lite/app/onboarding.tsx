import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const ONBOARDING_KEY = "afuchat_lite_onboarded_v1";

type Slide = {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "💬",
    iconBg: "#1E90FF",
    title: "Welcome to\nAfuChat Lite",
    subtitle:
      "A fast, lightweight messenger built for the people who matter most to you.",
  },
  {
    id: "2",
    icon: "⚡",
    iconBg: "#7C3AED",
    title: "Real-Time\nMessaging",
    subtitle:
      "Messages land instantly. See when someone is typing. Never miss a beat.",
  },
  {
    id: "3",
    icon: "📡",
    iconBg: "#059669",
    title: "Works\nOffline Too",
    subtitle:
      "Lost signal? Messages queue automatically and sync the moment you reconnect.",
  },
];

export const ONBOARDING_DONE_KEY = ONBOARDING_KEY;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  );

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(auth)/login");
  };

  const skip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(auth)/login");
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#06090F" />

      {/* Skip button */}
      {!isLast && (
        <Pressable
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={skip}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
        renderItem={({ item }) => (
          <SlideItem slide={item} insetTop={insets.top} />
        )}
      />

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        {/* CTA button */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaBtn,
            isLast && styles.ctaBtnLast,
            { opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={isLast ? finish : goNext}
        >
          <Text style={styles.ctaText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SlideItem({
  slide,
  insetTop,
}: {
  slide: Slide;
  insetTop: number;
}) {
  return (
    <View style={[styles.slide, { width, paddingTop: insetTop + 60 }]}>
      {/* Illustration area */}
      <View style={styles.illustrationWrap}>
        <View style={styles.bgCircleOuter}>
          <View style={styles.bgCircleInner}>
            <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
              <Text style={styles.iconEmoji}>{slide.icon}</Text>
            </View>
          </View>
        </View>

        {/* AfuChat logo for slide 1 */}
        {slide.id === "1" && (
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.appIcon}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06090F",
  },
  skipBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 52,
  },
  illustrationWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 280,
    height: 280,
    position: "relative",
  },
  bgCircleOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(30,144,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  bgCircleInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(30,144,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  iconEmoji: { fontSize: 58 },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    position: "absolute",
    bottom: 8,
    right: 8,
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  textBlock: { gap: 14, alignItems: "center" },
  title: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 300,
  },
  bottomBar: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 28,
    alignItems: "center",
  },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1E90FF",
  },
  ctaBtn: {
    width: "100%",
    backgroundColor: "#1E90FF",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaBtnLast: {
    backgroundColor: "#1E90FF",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
});
