import { StyleSheet, Text, View } from 'react-native'
import { Tabs } from 'expo-router'
import React from 'react'
import {Ionicons} from "@expo/vector-icons"

const TabsLayout = () => {
  return (
    <Tabs
        screenOptions={{
            tabBarActiveTintColor: "green",
            tabBarInactiveTintColor: "grey",
            headerShown: false,
        }}
    >
        <Tabs.Screen
            name='home'
            options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
            ),
            }}
        />
        <Tabs.Screen
            name='search'
            options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="search-outline" size={size} color={color} />
            ),
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
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
            ),
            }}
        />
    </Tabs>
  )
}

export default TabsLayout