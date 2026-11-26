import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import MemberLoginScreen from '../screens/auth/MemberLoginScreen';
import MemberAccountScreen from '../screens/member/MemberAccountScreen';
import SetPasswordScreen from '../screens/member/SetPasswordScreen';
import { MemberHomeScreen, MemberPaymentsScreen, MemberRatesScreen, ReceiptScreen } from '../screens/member/MemberScreens';
import DashboardScreen from '../screens/owner/DashboardScreen';
import { OwnerHistoryScreen, UploadDetailScreen } from '../screens/owner/OwnerHistoryScreens';
import OwnerSettingsScreen from '../screens/owner/OwnerSettingsScreen';
import StaffManagementScreen from '../screens/owner/StaffManagementScreen';
import CameraScreen from '../screens/staff/CameraScreen';
import StaffAccountScreen from '../screens/staff/StaffAccountScreen';
import ReviewScreen from '../screens/staff/ReviewScreen';
import StaffHistoryScreen from '../screens/staff/StaffHistoryScreen';
import SuccessScreen from '../screens/staff/SuccessScreen';
import { useAuthState, useServices } from '../state';
import { Loading, Screen, colors } from '../ui';
import type { AuthStackParams, MemberStackParams, MemberTabParams, OwnerHistoryParams, ScanStackParams } from './types';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, primary: colors.accent, text: colors.text } };
const headerless = { headerShown: false } as const;
// The tab bar: a little taller than the default so the labels are never clipped, plus the phone's bottom inset.
function useTabOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom },
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 11, lineHeight: 14, flexShrink: 0, fontWeight: '800' as const, letterSpacing: 0.3 },
  } as const;
}
const stackOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' as const },
  contentStyle: { backgroundColor: colors.bg },
} as const;

// A tab's icon: filled when its tab is open, outlined otherwise.
type IconName = 'camera' | 'time' | 'person-circle' | 'stats-chart' | 'people' | 'settings' | 'home' | 'receipt' | 'pricetags';
const icon =
  (name: IconName) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as const)} size={size} color={color} />
  );

const navigationRef = createNavigationContainerRef();

const AuthStack = createNativeStackNavigator<AuthStackParams>();
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={headerless}>
      {/* The first screen listed opens first: members are most of the people signing in. */}
      <AuthStack.Screen name="MemberLogin" component={MemberLoginScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

const ScanStack = createNativeStackNavigator<ScanStackParams>();
function ScanNavigator() {
  return (
    <ScanStack.Navigator screenOptions={stackOptions}>
      <ScanStack.Screen name="Camera" component={CameraScreen} options={{ title: 'Scan', headerShown: false }} />
      <ScanStack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
      <ScanStack.Screen name="Success" component={SuccessScreen} options={{ title: 'Saved', headerBackVisible: false }} />
    </ScanStack.Navigator>
  );
}

const HistoryStack = createNativeStackNavigator<OwnerHistoryParams>();
function OwnerHistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={stackOptions}>
      <HistoryStack.Screen name="OwnerHistory" component={OwnerHistoryScreen} options={{ headerShown: false }} />
      <HistoryStack.Screen name="UploadDetail" component={UploadDetailScreen} options={{ title: 'Page entries' }} />
    </HistoryStack.Navigator>
  );
}

const StaffTab = createBottomTabNavigator();
function StaffTabs() {
  return (
    <StaffTab.Navigator screenOptions={useTabOptions()}>
      <StaffTab.Screen name="Scan" component={ScanNavigator} options={{ tabBarIcon: icon('camera') }} />
      <StaffTab.Screen name="History" component={StaffHistoryScreen} options={{ tabBarIcon: icon('time') }} />
      <StaffTab.Screen name="Account" component={StaffAccountScreen} options={{ tabBarIcon: icon('person-circle') }} />
    </StaffTab.Navigator>
  );
}

const OwnerTab = createBottomTabNavigator();
function OwnerTabs() {
  return (
    <OwnerTab.Navigator screenOptions={useTabOptions()}>
      <OwnerTab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: icon('stats-chart') }} />
      <OwnerTab.Screen name="Scan" component={ScanNavigator} options={{ tabBarIcon: icon('camera') }} />
      <OwnerTab.Screen name="History" component={OwnerHistoryNavigator} options={{ tabBarIcon: icon('time') }} />
      <OwnerTab.Screen name="Staff" component={StaffManagementScreen} options={{ tabBarIcon: icon('people') }} />
      <OwnerTab.Screen name="Settings" component={OwnerSettingsScreen} options={{ tabBarIcon: icon('settings') }} />
    </OwnerTab.Navigator>
  );
}

const MemberTab = createBottomTabNavigator<MemberTabParams>();
function MemberTabs() {
  return (
    <MemberTab.Navigator screenOptions={useTabOptions()}>
      <MemberTab.Screen name="Home" component={MemberHomeScreen} options={{ tabBarIcon: icon('home') }} />
      <MemberTab.Screen name="Payments" component={MemberPaymentsScreen} options={{ tabBarIcon: icon('receipt') }} />
      <MemberTab.Screen name="Rates" component={MemberRatesScreen} options={{ title: 'Rates & News', tabBarIcon: icon('pricetags') }} />
      <MemberTab.Screen name="Account" component={MemberAccountScreen} options={{ tabBarIcon: icon('person-circle') }} />
    </MemberTab.Navigator>
  );
}

const MemberStack = createNativeStackNavigator<MemberStackParams>();
function MemberNavigator() {
  return (
    <MemberStack.Navigator screenOptions={stackOptions}>
      <MemberStack.Screen name="MemberTabs" component={MemberTabs} options={{ headerShown: false }} />
      <MemberStack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} />
    </MemberStack.Navigator>
  );
}

/** Shows the screens for whoever is signed in: login, staff or owner tabs, or the member screens. */
export default function RootNavigator() {
  const state = useAuthState();
  const { auth, notifications } = useServices();

  // A member opens the sign-in link from their email: it comes in as an address.
  useEffect(() => {
    const open = (url: string | null) => {
      if (url) auth.handleUrl(url).catch(() => undefined);
    };
    Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (e) => open(e.url));
    return () => subscription.remove();
  }, [auth]);

  // Tapping a renewal reminder opens Home.
  useEffect(() => notifications.onTap(() => navigationRef.isReady() && navigationRef.navigate('Home' as never)), [notifications]);

  let content;
  if (state.kind === 'loading') content = <Screen><Loading variant="page" /></Screen>;
  else if (state.kind === 'signedOut') content = <AuthNavigator />;
  else if (state.kind === 'member') content = state.needsPassword ? <SetPasswordScreen /> : <MemberNavigator />;
  else content = state.profile.role === 'owner' ? <OwnerTabs /> : <StaffTabs />;

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      {content}
    </NavigationContainer>
  );
}
