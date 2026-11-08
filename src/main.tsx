import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';
const PostProcessingWindow=React.lazy(()=>import('./PostProcessingWindow'));
const GameWindow=React.lazy(()=>import('./GameWindow'));
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('game')?<React.Suspense fallback={<div className="empty-state">…</div>}><GameWindow/></React.Suspense>:new URLSearchParams(location.search).has('postprocessing')?<React.Suspense fallback={<div className="empty-state">…</div>}><PostProcessingWindow/></React.Suspense>:<App/>);
