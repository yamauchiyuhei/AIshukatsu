import { installDesktopLifecycle } from './lib/desktopLifecycle';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import './styles/index.css';
(globalThis as unknown as {Buffer:typeof Buffer}).Buffer=Buffer;
void installDesktopLifecycle().catch(()=>window.dispatchEvent(new Event('aishukatsu-save-error')));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
