import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TripProvider } from './state/TripProvider'
import Board from './components/Board'

export default function App() {
  return (
    <BrowserRouter>
      <TripProvider>
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </BrowserRouter>
  )
}
