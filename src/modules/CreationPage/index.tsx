import classNames from "classnames";
// import EmptyState from "components/EmptyState";
// import { toast } from "react-toastify";
import useNFTMarket from "state/nft-market";
import useSigner from "state/signer";
import CreationForm, { CreationValues } from "./CreationForm";

const CreationPage = () => {
  const { signer } = useSigner();

  const { createNFT } = useNFTMarket();

  return (
    <div 
    className={classNames("flex h-full w-full flex-col", {
    "item-center justify-center": !signer,  
    })}
    >
     {signer ? <CreationForm onSubmit={createNFT} /> : "connect your wallet"}
       
    </div>
  );
};

export default CreationPage;