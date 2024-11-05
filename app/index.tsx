import { UserProvider } from '../context/UserContext';
import { InvitationsProvider } from '../context/InvitationsContext';
import { registerRootComponent } from 'expo';
import App from './App';

const Root: React.FC = () => {
  return (
    <UserProvider>
      <InvitationsProvider>
        <App />
      </InvitationsProvider>
    </UserProvider>
  );
};

export default Root;

registerRootComponent(App);
