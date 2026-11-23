import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Admin } from './pages/Admin';
import { Community } from './pages/Community';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Notifications } from './pages/Notifications';
import { Play } from './pages/Play';
import { Settings } from './pages/Settings';
import { Signup } from './pages/Signup';
import { Wallet } from './pages/Wallet';
import { Welcome } from './pages/Welcome';

export function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="community" element={<Community />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
