import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.optimizers import Adam
from collections import deque
import random
import os

class DQN_Agent:
    def __init__(self, state_size, action_size=2):
        self.state_size = state_size
        self.action_size = action_size
        self.memory = deque(maxlen=2000)
        
        # Hyperparameters
        self.gamma = 0.95    # discount rate
        self.epsilon = 1.0   # exploration rate
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995
        self.learning_rate = 0.001
        self.model = self._build_model()

    def _build_model(self):
        # Neural Net for Deep Q-Learning
        model = Sequential()
        model.add(Dense(24, input_dim=self.state_size, activation='relu'))
        model.add(Dropout(0.2))
        model.add(Dense(24, activation='relu'))
        model.add(Dropout(0.2))
        model.add(Dense(self.action_size, activation='linear'))
        model.compile(loss='mse', optimizer=Adam(learning_rate=self.learning_rate))
        return model

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        act_values = self.model.predict(state, verbose=0)
        return np.argmax(act_values[0])

    def replay(self, batch_size):
        if len(self.memory) < batch_size:
            return
            
        minibatch = random.sample(self.memory, batch_size)
        
        # Extract components and ensure correct shape (batch_size, state_size)
        states = np.array([i[0] for i in minibatch])
        if states.ndim == 3: # Handle (batch, 1, 8) -> (batch, 8)
            states = np.squeeze(states, axis=1)
            
        actions = np.array([i[1] for i in minibatch])
        rewards = np.array([i[2] for i in minibatch])
        
        next_states = np.array([i[3] for i in minibatch])
        if next_states.ndim == 3:
            next_states = np.squeeze(next_states, axis=1)
            
        dones = np.array([i[4] for i in minibatch])

        # Vectorized Prediction
        targets = self.model.predict_on_batch(states)
        next_q_values = self.model.predict_on_batch(next_states)

        # Update Targets
        for i in range(batch_size):
            if dones[i]:
                targets[i][actions[i]] = rewards[i]
            else:
                targets[i][actions[i]] = rewards[i] + self.gamma * np.amax(next_q_values[i])

        # Train on Batch
        self.model.fit(states, targets, epochs=1, verbose=0)
            
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

    def load(self, name):
        if os.path.exists(name):
            self.model = load_model(name)
            print(f"Loaded RL model from {name}")
        else:
            print(f"Model file {name} not found, starting fresh.")

    def save(self, name):
        self.model.save(name)
        print(f"Saved RL model to {name}")
