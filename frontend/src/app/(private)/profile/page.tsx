import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';


const Profile = async () => {
  const session = await auth()
  if (!session) redirect("/")
  return (
    <div className='flex justify-center items-center flex-col'>
      
      
    </div>
  );


};

export default Profile;