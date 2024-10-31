import { UserProvider } from '../context/UserContext';
import { registerRootComponent } from 'expo';
import App from './App';

const Root: React.FC = () => {
  return (
    <UserProvider>
      <App />
    </UserProvider>
  );
};

export default Root;

registerRootComponent(App);
