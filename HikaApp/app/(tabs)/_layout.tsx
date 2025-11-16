import { StyleSheet, Text, View, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import React, { useState } from 'react'
import { Ionicons } from "@expo/vector-icons"
import { AddHikeModal } from '../../components/ui/AddHikeModal'
import { CustomTabBar } from '../../components/ui/CustomTabBar'

const TabsLayout = () => {
  const [showAddHikeModal, setShowAddHikeModal] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#92C59F", // hika-green
          tabBarInactiveTintColor: "#516D58", // hika-darkgreen
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarStyle: {
            display: 'none', // Hide default tab bar
          },
        }}
        tabBar={(props) => (
          <CustomTabBar {...props} onAddHikePress={() => setShowAddHikeModal(true)} />
        )}
      >
      <Tabs.Screen
        name='home'
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={focused ? 28 : 24} 
              color={color} 
            />
          ),
          tabBarLabelStyle: ({ focused }: any) => ({
            fontSize: focused ? 14 : 12,
            fontWeight: focused ? 'bold' : '600',
          }),
        }}
      />
      <Tabs.Screen
        name='search'
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "search" : "search-outline"} 
              size={focused ? 28 : 24} 
              color={color} 
            />
          ),
          tabBarLabelStyle: ({ focused }: any) => ({
            fontSize: focused ? 14 : 12,
            fontWeight: focused ? 'bold' : '600',
          }),
        }}
      />
      <Tabs.Screen
            name='leaderboard'
            options={{
            title: "Leaderboard",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy-outline" size={size} color={color} />
            ),
            }}
        />
      <Tabs.Screen
        name='profile'
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={focused ? 28 : 24} 
              color={color} 
            />
          ),
          tabBarLabelStyle: ({ focused }: any) => ({
            fontSize: focused ? 14 : 12,
            fontWeight: focused ? 'bold' : '600',
          }),
        }}
      />
      </Tabs>
      <AddHikeModal
        visible={showAddHikeModal}
        onClose={() => setShowAddHikeModal(false)}
      />
    </>
  )
}

export default TabsLayout