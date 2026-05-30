import struct
import binascii

def hex_to_pcap(hex_file_path, pcap_file_path):
    # PCAP Global Header
    # Magic Number (4B): 0xa1b2c3d4
    # Major Version (2B): 2
    # Minor Version (2B): 4
    # GMT to Local Correction (4B): 0
    # Accuracy of Timestamps (4B): 0
    # Snaplen (4B): 65535
    # Data Link Type (4B): 1 (Ethernet)
    pcap_global_header = struct.pack("<IHHiIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1)

    # Start timestamp at 2026-05-01 10:00:00 UTC (1777632000)
    base_ts_sec = 1777632000
    ts_usec = 0

    with open(hex_file_path, 'r') as f_in, open(pcap_file_path, 'wb') as f_out:
        # Write PCAP global header
        f_out.write(pcap_global_header)
        
        packet_count = 0
        for line in f_in:
            line = line.strip()
            if not line:
                continue
            
            # Split line into offset/index and hex data
            # Format: "000000 ffffff..."
            parts = line.split()
            if len(parts) < 2:
                continue
            
            hex_data = parts[1]
            try:
                packet_bytes = binascii.unhexlify(hex_data)
            except Exception as e:
                print(f"Skipping line: {line[:50]}... due to error: {e}")
                continue
            
            pkt_len = len(packet_bytes)
            
            # Increment timestamp slightly for each packet
            # 10ms per packet
            ts_usec += 10000
            if ts_usec >= 1000000:
                base_ts_sec += 1
                ts_usec = ts_usec % 1000000
            
            # PCAP Packet Header
            # Timestamp seconds (4B)
            # Timestamp microseconds (4B)
            # Length of packet saved in PCAP (4B)
            # Original length of packet (4B)
            pcap_packet_header = struct.pack("<IIII", base_ts_sec, ts_usec, pkt_len, pkt_len)
            
            # Write header and packet data
            f_out.write(pcap_packet_header)
            f_out.write(packet_bytes)
            packet_count += 1
            
        print(f"Successfully converted {packet_count} packets to {pcap_file_path}")

if __name__ == "__main__":
    hex_to_pcap("packets.hex", "packets.pcap")
