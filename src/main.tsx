import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { loadDigitClassifier } from './core/digitClassifier';

// Warm the digit CNN in the background so clock scoring is instant.
void loadDigitClassifier();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
