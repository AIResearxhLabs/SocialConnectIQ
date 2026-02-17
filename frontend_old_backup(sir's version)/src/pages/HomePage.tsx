import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Container,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from '../api/firebase';

interface Area {
  id: string;
  name: string;
}

interface Domain {
  id:string;
  name: string;
  areas: Area[];
}

const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [interests, setInterests] = useState<Record<string, string[]>>({});
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchDomains = async () => {
      const domainsCollection = collection(firestore, 'domains');
      const domainsSnapshot = await getDocs(domainsCollection);
      return domainsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Domain[];
    };

    const fetchUserInterests = async () => {
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      return userDoc.exists() ? userDoc.data().interestedDomains || {} : {};
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        const [domainsData, userInterests] = await Promise.all([
          fetchDomains(),
          fetchUserInterests(),
        ]);
        setDomains(domainsData);
        setInterests(userInterests);
      } catch (error) {
        console.error("Error fetching data: ", error);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentUser]);

  const getDomainName = (domainId: string) => {
    const domain = domains.find((d) => d.id === domainId);
    return domain ? domain.name : 'Unknown Domain';
  };

  const getAreaName = (domainId: string, areaId: string) => {
    const domain = domains.find((d) => d.id === domainId);
    if (domain) {
      const area = domain.areas.find((a) => a.id === areaId);
      return area ? area.name : 'Unknown Area';
    }
    return 'Unknown Area';
  };
  
  if (loading) {
    return <CircularProgress />;
  }

  if (!currentUser) {
    return (
      <Container>
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to the Social Media Management App
          </Typography>
          <Button component={Link} to="/signin" variant="contained" color="primary">
            Sign In
          </Button>
          <Button component={Link} to="/signup" variant="contained" color="secondary" sx={{ ml: 2 }}>
            Sign Up
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back!
        </Typography>

        <Card>
          <CardContent>
            <Typography variant="h6">Your Interests</Typography>
            {Object.keys(interests).length > 0 ? (
              Object.keys(interests).map((domainId) =>
                interests[domainId] && interests[domainId].length > 0 ? (
                  <Box key={domainId} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {getDomainName(domainId)}
                    </Typography>
                    <Box>
                      {interests[domainId].map((areaId) => (
                        <Chip
                          key={areaId}
                          label={getAreaName(domainId, areaId)}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : null
              )
            ) : (
              <Typography>
                You haven't selected any interests yet. Go to your{' '}
                <Link to="/profile">profile</Link> to add some.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default HomePage;
