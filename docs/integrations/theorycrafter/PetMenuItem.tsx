import { PawPrint } from "lucide-react";
import { useSidekick } from "sidekick-pet/react";
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

/** "Website pet" on/off switch for the profile dropdown. */
export const PetMenuItem = () => {
  const pet = useSidekick();
  if (!pet.ready) return null;

  return (
    <>
      <DropdownMenuCheckboxItem
        checked={pet.enabled}
        onCheckedChange={(on) => (on ? pet.enable() : pet.disable())}
        // Keep the menu open so the change is visible.
        onSelect={(e) => e.preventDefault()}
      >
        <PawPrint className="mr-2 h-4 w-4" />
        <span>Website pet</span>
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
    </>
  );
};

export default PetMenuItem;
