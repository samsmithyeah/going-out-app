import { UserProvider } from '../context/UserContext';
import { CrewsProvider } from '../context/CrewsContext';
import { InvitationsProvider } from '../context/InvitationsContext';
import { registerRootComponent } from 'expo';
import App from './App';

const Root: React.FC = () => {
  return (
    <UserProvider>
      <CrewsProvider>
        <InvitationsProvider>
          <App />
        </InvitationsProvider>
      </CrewsProvider>
    </UserProvider>
  );
};

export default Root;

registerRootComponent(App);
