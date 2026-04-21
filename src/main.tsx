import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './app/store'
import App from './app/App'
import './index.css'
import { applyUiTheme, getEffectivePalette, getUiTheme } from './shared/constants/uiThemes'

// Apply the persisted UI theme + mode to :root before first paint so the
// chrome (panels, controls) never flashes the CSS default palette when the
// initial state doesn't match.
{
  const s = store.getState().mapStyle
  applyUiTheme(getEffectivePalette(getUiTheme(s.selectedUiTheme), s.uiMode))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
)
