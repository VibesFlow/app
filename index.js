// Load all polyfills first for cross-platform compatibility
import './configs/polyfills';

import { registerRootComponent } from 'expo';
import App from './App';

// Register the main App component as the root component
registerRootComponent(App); 