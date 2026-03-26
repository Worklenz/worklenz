// PPM-OVERRIDE: Replace Worklenz logo with PPM P icon mark
import { Link } from 'react-router-dom';

const NavbarLogo = () => {
  return (
    <Link to={'/taskflow/home'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={24}
        viewBox="0 0 13 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9.83268 0H0V19.648L4.47421 12.5322H9.83268C11.4847 12.5322 12.8243 11.0943 12.8243 9.32101V3.2112C12.8243 1.43794 11.4847 0 9.83268 0ZM10.1768 9.57108C10.1768 9.71317 10.0709 9.82684 9.93858 9.82684H2.55215V2.84177H9.93328C10.0657 2.84177 10.1716 2.95544 10.1716 3.09753V9.57108H10.1768Z"
          fill="#0061FF"
        />
      </svg>
    </Link>
  );
};

export default NavbarLogo;
