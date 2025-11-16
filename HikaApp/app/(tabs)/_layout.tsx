import { StyleSheet, Text, View, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import React from 'react'
import { Ionicons } from "@expo/vector-icons"

const TabsLayout = () => {
  return (
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
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingBottom: Platform.OS === 'ios' ? 25 : 8,
          paddingTop: 8,
          backgroundColor: '#ffffff',
        },
      }}
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
  )
}

export default TabsLayout