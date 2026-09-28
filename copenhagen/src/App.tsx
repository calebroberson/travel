import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TripProvider } from './state/TripProvider'
import AppShell from './components/AppShell'
import Board from './components/Board'
import DayView, { DaysIndex } from './components/days/DayView'

export default function App() {
  return (
    <BrowserRouter>
      <TripProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Board />} />
            <Route path="days" element={<DaysIndex />} />
            <Route path="days/:date" element={<DayView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </BrowserRouter>
  )
}
