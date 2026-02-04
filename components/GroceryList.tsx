import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    TouchableOpacity,
    Text,
    FlatList,
    Alert,
    Keyboard,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Modal
} from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';

type GroceryItem = {
    id: string;
    name: string;
    isEditing: boolean;
    healthSuggestion?: string;
    suggestionReason?: string;
    showingSuggestion?: boolean;
    isLoadingSuggestion?: boolean;
};

// Storage key for OpenRouter API key
const HEALTH_API_KEY_STORAGE = 'openrouter_api_key';

export default function GroceryList() {
    const [items, setItems] = useState<GroceryItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [editText, setEditText] = useState('');
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

    // Use theme colors for text/buttons, but do NOT use backgroundColor for containers
    const textColor = useThemeColor({}, 'text');
    const tintColor = useThemeColor({}, 'tint');

    // Fetch API key on component mount
    useEffect(() => {
        const getApiKey = async () => {
            try {
                // Retrieve the API key from AsyncStorage
                const storedApiKey = await AsyncStorage.getItem(HEALTH_API_KEY_STORAGE);
                if (storedApiKey) {
                    setApiKey(storedApiKey);
                } else {
                    // If no API key is stored, show the modal
                    setIsApiKeyModalVisible(true);
                }
            } catch (error) {
                console.error('Error retrieving API key:', error);
                setApiKeyError('Failed to retrieve API key');
                setIsApiKeyModalVisible(true);
            }
        };

        getApiKey();
    }, []);

    // Save API key to AsyncStorage
    const saveApiKey = async () => {
        if (apiKeyInput.trim() === '') {
            setApiKeyError('Please enter a valid API key');
            return;
        }

        try {
            await AsyncStorage.setItem(HEALTH_API_KEY_STORAGE, apiKeyInput);
            setApiKey(apiKeyInput);
            setApiKeyError(null);
            setIsApiKeyModalVisible(false);
        } catch (error) {
            console.error('Error saving API key:', error);
            setApiKeyError('Failed to save API key');
        }
    };

    // Function to get health suggestion from OpenRouter API
    const getHealthSuggestion = async (itemId: string, itemName: string) => {
        // Check if we have an API key first
        if (!apiKey) {
            setIsApiKeyModalVisible(true);
            return;
        }

        // Mark item as loading suggestion
        setItems(prevItems => prevItems.map(item =>
            item.id === itemId
                ? { ...item, isLoadingSuggestion: true }
                : item
        ));

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://grocerylistapp.example.com', // Replace with your domain
                    'X-Title': 'Grocery List App'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a nutrition expert that provides brief, helpful suggestions for healthier food alternatives. Format your response with the alternative on the first line and the explanation on the second line.'
                        },
                        {
                            role: 'user',
                            content: `Suggest a healthier grocery alternative for "${itemName}" and explain why it's healthier in one sentence.`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();
            const suggestion = data.choices?.[0]?.message?.content;

            if (suggestion) {
                // Parse the suggestion into alternative and reason
                const lines = suggestion.split('\n').filter(line => line.trim() !== '');
                const healthSuggestion = lines[0]?.trim();
                const suggestionReason = lines.length > 1 ? lines.slice(1).join(' ').trim() : '';

                // Update the item with the suggestion
                setItems(prevItems => prevItems.map(item =>
                    item.id === itemId
                        ? {
                            ...item,
                            healthSuggestion,
                            suggestionReason,
                            showingSuggestion: true,
                            isLoadingSuggestion: false
                        }
                        : item
                ));
            }
        } catch (error) {
            console.error('Error getting health suggestion:', error);
            Alert.alert('Error', 'Failed to get health suggestion. Please try again.');

            // Reset loading state
            setItems(prevItems => prevItems.map(item =>
                item.id === itemId
                    ? { ...item, isLoadingSuggestion: false }
                    : item
            ));
        }
    };

    // Function to replace original item with suggestion
    const replaceFoodItem = (id: string) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === id && item.healthSuggestion) {
                return {
                    ...item,
                    name: item.healthSuggestion,
                    healthSuggestion: undefined,
                    suggestionReason: undefined,
                    showingSuggestion: false
                };
            }
            return item;
        }));
    };

    // Function to dismiss suggestion
    const dismissSuggestion = (id: string) => {
        setItems(prevItems => prevItems.map(item =>
            item.id === id
                ? {
                    ...item,
                    showingSuggestion: false
                }
                : item
        ));
    };

    const addItem = () => {
        if (inputText.trim() === '') return;

        const newItemId = Date.now().toString();
        const newItemName = inputText.trim();

        const newItem = {
            id: newItemId,
            name: newItemName,
            isEditing: false
        };

        setItems(prevItems => [...prevItems, newItem]);
        setInputText('');

        // Return focus to input field after a short delay
        setTimeout(() => {
            if (inputRef) {
                inputRef.focus();
            }
        }, 50);

        // Get health suggestion for the new item
        getHealthSuggestion(newItemId, newItemName);
    };

    const deleteItem = (id: string) => {
        Alert.alert(
            "Delete Item",
            "Are you sure you want to delete this item?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        setItems(items.filter(item => item.id !== id));
                    }
                }
            ]
        );
    };

    const startEditing = (id: string) => {
        const updatedItems = items.map(item => {
            if (item.id === id) {
                setEditText(item.name);
                return { ...item, isEditing: true };
            }
            return { ...item, isEditing: false };
        });
        setItems(updatedItems);
    };

    const saveEdit = (id: string) => {
        if (editText.trim() === '') return;

        const updatedItems = items.map(item => {
            if (item.id === id) {
                return { ...item, name: editText.trim(), isEditing: false };
            }
            return item;
        });

        setItems(updatedItems);
        setEditText('');
        Keyboard.dismiss();
    };

    const renderItem = ({ item }: { item: GroceryItem }) => (
        <ThemedView style={styles.itemContainer}>
            {item.isEditing ? (
                <View style={styles.editContainer}>
                    <TextInput
                        style={[styles.editInput, { color: textColor }]}
                        value={editText}
                        onChangeText={setEditText}
                        autoFocus
                        blurOnSubmit={false}
                        onSubmitEditing={() => saveEdit(item.id)}
                        returnKeyType="done"
                    />
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: tintColor }]}
                        onPress={() => saveEdit(item.id)}
                    >
                        <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.itemContentContainer}>
                    <View style={styles.itemTopRow}>
                        <ThemedText style={styles.itemText}>{item.name}</ThemedText>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: tintColor }]}
                                onPress={() => startEditing(item.id)}
                            >
                                <Text style={styles.buttonText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.deleteButton]}
                                onPress={() => deleteItem(item.id)}
                            >
                                <Text style={styles.buttonText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Health suggestion area */}
                    {item.isLoadingSuggestion && (
                        <View style={styles.suggestionLoading}>
                            <ActivityIndicator color={tintColor} />
                            <ThemedText style={styles.suggestionLoadingText}>Finding healthier alternative...</ThemedText>
                        </View>
                    )}

                    {item.showingSuggestion && item.healthSuggestion && (
                        <View style={styles.suggestionContainer}>
                            <View style={styles.suggestionContent}>
                                <ThemedText style={styles.suggestionTitle}>Healthier Alternative:</ThemedText>
                                <ThemedText style={styles.suggestionText}>{item.healthSuggestion}</ThemedText>
                                {item.suggestionReason && (
                                    <ThemedText style={styles.suggestionReason}>{item.suggestionReason}</ThemedText>
                                )}
                            </View>
                            <View style={styles.suggestionButtonRow}>
                                <TouchableOpacity
                                    style={[styles.suggestionButton, { backgroundColor: '#4CD964' }]} // Green color
                                    onPress={() => replaceFoodItem(item.id)}
                                >
                                    <Text style={styles.buttonText}>✅ Replace Original</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.suggestionButton, { backgroundColor: '#8E8E93' }]} // Gray color
                                    onPress={() => dismissSuggestion(item.id)}
                                >
                                    <Text style={styles.buttonText}>❌ Keep Original</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </ThemedView>
    );

    // Focus the input field when component mounts
    const [inputRef, setInputRef] = useState<TextInput | null>(null);

    useEffect(() => {
        // Small delay to ensure the component is fully rendered
        const timer = setTimeout(() => {
            if (inputRef) {
                inputRef.focus();
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [inputRef]);

    return (
        <View style={styles.container}>
            {/* Add top padding to avoid status bar */}
            <View style={styles.spacer} />

            {/* Title at the top for visibility */}
            <View style={styles.headerRow}>
                <ThemedText type="title" style={styles.headerTitle}>AteWell.AI 🍽️💡</ThemedText>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => {
                        setApiKeyInput(apiKey || '');
                        setApiKeyError(null);
                        setIsApiKeyModalVisible(true);
                    }}
                >
                    <Text style={styles.settingsButtonText}>⚙️</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
                <TextInput
                    ref={(ref) => setInputRef(ref)}
                    style={[styles.input, { color: textColor }]}
                    placeholder="Add an item..."
                    placeholderTextColor="#888"
                    value={inputText}
                    onChangeText={setInputText}
                    autoFocus={true}
                    blurOnSubmit={false}
                    onSubmitEditing={addItem}
                    returnKeyType="done"
                    enablesReturnKeyAutomatically={true}
                />
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: tintColor }]}
                    onPress={addItem}
                >
                    <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* List area can be tapped to dismiss keyboard */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.listContainer}>
                    <FlatList
                        data={items}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        style={styles.list}
                        ListEmptyComponent={
                            <ThemedText style={styles.emptyListText}>
                                Your grocery list is empty. Add some items!
                            </ThemedText>
                        }
                    />
                </View>
            </TouchableWithoutFeedback>

            {/* OpenRouter API Key Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isApiKeyModalVisible}
                onRequestClose={() => {
                    if (apiKey) {
                        setIsApiKeyModalVisible(false);
                    }
                }}
            >
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)'
                }}>
                    <View style={{
                        width: '80%',
                        backgroundColor: 'white',
                        borderRadius: 10,
                        padding: 20,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 5
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            marginBottom: 15,
                            textAlign: 'center'
                        }}>
                            OpenRouter API Key Required
                        </Text>

                        <Text style={{
                            marginBottom: 20,
                            textAlign: 'center'
                        }}>
                            To suggest healthier alternatives for your grocery items, please enter your OpenRouter API key.
                        </Text>

                        <TextInput
                            style={{
                                width: '100%',
                                height: 50,
                                borderWidth: 1,
                                borderColor: apiKeyError ? '#FF3B30' : '#ccc',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                marginBottom: 10
                            }}
                            placeholder="Enter your OpenRouter API key"
                            value={apiKeyInput}
                            onChangeText={setApiKeyInput}
                            secureTextEntry={true}
                        />

                        {apiKeyError && (
                            <Text style={{ color: '#FF3B30', marginBottom: 10 }}>
                                {apiKeyError}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={{
                                backgroundColor: tintColor,
                                paddingVertical: 12,
                                paddingHorizontal: 20,
                                borderRadius: 8,
                                width: '100%',
                                alignItems: 'center',
                                marginTop: 10
                            }}
                            onPress={saveApiKey}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Save API Key</Text>
                        </TouchableOpacity>

                        {apiKey && (
                            <TouchableOpacity
                                style={{ marginTop: 15 }}
                                onPress={() => setIsApiKeyModalVisible(false)}
                            >
                                <Text style={{ color: tintColor }}>Cancel</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: 'transparent', // Must be transparent for gradient to show
    },
    spacer: {
        height: 40, // Add safe area at the top for status bar
    },
    title: {
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    input: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    addButton: {
        width: 80,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    listContainer: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    itemContainer: {
        flexDirection: 'column', // Changed to column for suggestions
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    itemContentContainer: {
        flex: 1,
        width: '100%',
    },
    itemTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    itemText: {
        flex: 1,
        fontSize: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginLeft: 8,
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
    },
    editContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    editInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingHorizontal: 10,
        marginRight: 8,
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
        color: '#888',
    },
    // Suggestion styles
    suggestionLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        padding: 8,
        backgroundColor: '#f5f5f5',
        borderRadius: 6,
    },
    suggestionLoadingText: {
        marginLeft: 8,
        fontSize: 14,
        fontStyle: 'italic',
    },
    suggestionContainer: {
        marginTop: 10,
        backgroundColor: '#f0f8ff', // Light blue background
        borderRadius: 6,
        padding: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#4CD964', // Green border
    },
    suggestionContent: {
        marginBottom: 8,
    },
    suggestionTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    suggestionText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    suggestionReason: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#666',
        marginTop: 2,
    },
    suggestionButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    suggestionButton: {
        flex: 1,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        marginHorizontal: 4,
    },
    bottomTitle: {
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2089dc', // A nice blue color that should stand out
    },
    headerTitle: {
        marginTop: 10,
        marginBottom: 15,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2089dc', // A nice blue color that should stand out
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
    },
    settingsButton: {
        position: 'absolute',
        right: 0,
        padding: 8,
    },
    settingsButtonText: {
        fontSize: 24,
    },
});
