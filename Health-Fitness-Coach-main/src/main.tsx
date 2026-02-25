import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import './components/app-shell.css';
import "./styles/nutrition.css";
import "./styles/posture.css";
import "./styles/workouts.css";
import "./styles/plan.css";
import "./styles/setting.css";
import "./styles/coach.css";
import "./styles/download-modal.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
