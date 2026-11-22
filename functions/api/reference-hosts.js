// Allowed document hosts for read-only project archive downloads.
const accepted=["digikey.com","mouser.com","onsemi.com","nexperia.com","ti.com","st.com","st.com.cn","infineon.com","vishay.com","analog.com","microchip.com","sparkfun.com","adafruit.com","pololu.com","arduino.cc","rs-online.com","farnell.com","newark.com","arrow.com","jameco.com","mcmaster.com"];
export const workshopHostAllowed=host=>accepted.some(domain=>host===domain||host.endsWith("."+domain));
