import { useEffect } from 'react';
import { Linking, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import MemberLoginScreen from '../screens/auth/MemberLoginScreen';
import { MemberHomeScreen, MemberPaymentsScreen, MemberRatesScreen, ReceiptScreen } from '../screens/member/MemberScreens';
import DashboardScreen from '../screens/owner/DashboardScreen';
import { OwnerHistoryScreen, UploadDetailScreen } from '../screens/owner/OwnerHistoryScreens';
import OwnerSettingsScreen from '../screens/owner/OwnerSettingsScreen';
import StaffManagementScreen from '../screens/owner/StaffManagementScreen';
import CameraScreen from '../screens/staff/CameraScreen';
import ReviewScreen from '../screens/staff/ReviewScreen';
import StaffHistoryScreen from '../screens/staff/StaffHistoryScreen';
import SuccessScreen from '../screens/staff/SuccessScreen';
import { useAuthState, useServices } from '../state';
import { Button, Loading, Screen, colors } from '../ui';
import type { AuthStackParams, MemberStackParams, MemberTabParams, OwnerHistoryParams, ScanStackParams } from './types';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, primary: colors.accent, text: colors.text } };
const headerless = { headerShown: false } as const;
const tabOptions = {
  headerShown: false,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' as const },
} as const;
const stackOptions = { headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } } as const;

// A tab's icon: a simple glyph, so no icon font has to be loaded.
const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

const navigationRef = createNavigationContainerRef();

const AuthStack = createNativeStackNavigator<AuthStackParams>();
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={headerless}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="MemberLogin" component={MemberLoginScreen} />
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
    <StaffTab.Navigator screenOptions={tabOptions}>
      <StaffTab.Screen name="Scan" component={ScanNavigator} options={{ tabBarIcon: icon('◉') }} />
      <StaffTab.Screen name="History" component={StaffHistoryScreen} options={{ tabBarIcon: icon('☰') }} />
      <StaffTab.Screen name="Account" component={StaffAccountScreen} options={{ tabBarIcon: icon('☺') }} />
    </StaffTab.Navigator>
  );
}

/** Staff have no settings page of their own; this is just Sign Out. */
function StaffAccountScreen() {
  const { auth } = useServices();
  const state = useAuthState();
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{state.kind === 'staff' ? state.profile.fullName : ''}</Text>
      <Text style={{ color: colors.muted }}>{state.kind === 'staff' ? state.profile.email : ''}</Text>
      <Button title="Sign Out" kind="danger" onPress={() => auth.signOut()} />
    </Screen>
  );
}

const OwnerTab = createBottomTabNavigator();
function OwnerTabs() {
  return (
    <OwnerTab.Navigator screenOptions={tabOptions}>
      <OwnerTab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: icon('▦') }} />
      <OwnerTab.Screen name="Scan" component={ScanNavigator} options={{ tabBarIcon: icon('◉') }} />
      <OwnerTab.Screen name="History" component={OwnerHistoryNavigator} options={{ tabBarIcon: icon('☰') }} />
      <OwnerTab.Screen name="Staff" component={StaffManagementScreen} options={{ tabBarIcon: icon('☺') }} />
      <OwnerTab.Screen name="Settings" component={OwnerSettingsScreen} options={{ tabBarIcon: icon('⚙') }} />
    </OwnerTab.Navigator>
  );
}

const MemberTab = createBottomTabNavigator<MemberTabParams>();
function MemberTabs() {
  return (
    <MemberTab.Navigator screenOptions={tabOptions}>
      <MemberTab.Screen name="Home" component={MemberHomeScreen} options={{ tabBarIcon: icon('⌂') }} />
      <MemberTab.Screen name="Payments" component={MemberPaymentsScreen} options={{ tabBarIcon: icon('₱') }} />
      <MemberTab.Screen name="Rates" component={MemberRatesScreen} options={{ title: 'Rates & News', tabBarIcon: icon('★') }} />
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
  if (state.kind === 'loading') content = <Screen><Loading /></Screen>;
  else if (state.kind === 'signedOut') content = <AuthNavigator />;
  else if (state.kind === 'member') content = <MemberNavigator />;
  else content = state.profile.role === 'owner' ? <OwnerTabs /> : <StaffTabs />;

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      {content}
    </NavigationContainer>
  );
}
