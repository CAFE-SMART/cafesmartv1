import { Capacitor } from '@capacitor/core';

const isAndroid = Capacitor.getPlatform() === 'android';

const API_URL = isAndroid
  ? 'http://10.0.2.2:3000'
  : import.meta.env.VITE_API_URL;

export default API_URL;