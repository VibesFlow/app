// Load all polyfills first
import './configs/polyfills';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);